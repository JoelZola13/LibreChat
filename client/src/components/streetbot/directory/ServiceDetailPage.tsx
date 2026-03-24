import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  Heart,
  Share2,
  MapPin,
  Phone,
  Mail,
  Globe,
  BadgeCheck,
  Navigation,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
} from "lucide-react";
import { useActiveUser } from "../shared/useActiveUser";
import { useUserRole } from "~/components/streetbot/lib/auth/useUserRole";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { readSessionCache, writeSessionCache } from '../shared/perfCache';
import { SERVICE_CACHE_PREFIX, SERVICE_CACHE_TTL_MS } from './serviceDetailPrefetch';
import { useGlassStyles } from "../shared/useGlassStyles";
import { useResponsive } from "../hooks/useResponsive";
import DirectoryNavBar from "./DirectoryNavBar";
import ClaimModal from "./ClaimModal";
import AuthPopupModal from "../shared/AuthPopupModal";
import { useAuthContext } from "~/hooks";
import {
  clearPendingProviderSignup,
  readPendingProviderSignup,
} from "../shared/providerSignup";
import { trackEvent } from '../lib/posthog';

// =============================================================================
// Types
// =============================================================================

interface Service {
  id: number;
  name: string;
  overview?: string;
  description?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  address?: string;
  category_names?: string[];
  tags?: string[];
  contact_structured?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  is_verified?: boolean;
  rating?: number;
  rating_count?: number;
  slug?: string;
  image_url?: string;
  gallery?: string[];
  website?: string;
  email?: string;
  phone?: string;
  hours?: Record<string, string>;
  logo?: string;
  claimed_by?: string;
}

interface ProviderProfile {
  user_id: string;
  account_type: string;
  organization_name?: string;
  organization_role?: string;
}

interface ListingClaim {
  id: number | string;
  mongo_id?: string;
  service_id: number;
  user_id: string;
  status: string;
  claimant_name?: string;
  claimant_email?: string;
  claimant_role?: string;
  organization?: string;
}

interface ClaimServiceStatus {
  service_id: number;
  is_claimed: boolean;
  is_verified: boolean;
  claimed_by: string | null;
  claim_status: string;
}

interface Review {
  id: number;
  service_id: number;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

// =============================================================================
// Helpers
// =============================================================================

import { getOrCreateUserId } from '~/components/streetbot/shared/getOrCreateUserId';

function formatPhone(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function renderStars(rating: number, size = 16, color = "#FFD600") {
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={size}
        color={color}
        fill={i <= Math.round(rating) ? color : "none"}
        style={{ flexShrink: 0 }}
      />,
    );
  }
  return stars;
}

function applyClaimStatus(service: Service, claimStatus?: ClaimServiceStatus | null): Service {
  if (!claimStatus) {
    return service;
  }

  return {
    ...service,
    claimed_by: claimStatus.is_claimed ? claimStatus.claimed_by : null,
    is_verified: Boolean(claimStatus.is_verified),
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// =============================================================================
// Component
// =============================================================================

export default function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { activeUser: authUser, resolved: sessionResolved } = useActiveUser();
  const { token } = useAuthContext();
  const { role: userRole, isAdmin } = useUserRole();
  const userId = getOrCreateUserId(authUser?.id);
  const { colors, glassCard } = useGlassStyles();
  const { isMobile, isTablet } = useResponsive();

  // Read prefetched service data from session cache (written by hover prefetch)
  const serviceCacheKey = serviceId ? `${SERVICE_CACHE_PREFIX}${serviceId}` : '';
  const cachedService = serviceCacheKey ? readSessionCache<Service>(serviceCacheKey, SERVICE_CACHE_TTL_MS) : null;

  const [service, setService] = useState<Service | null>(cachedService);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedServices, setRelatedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(!cachedService);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Claim system state
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [myClaim, setMyClaim] = useState<ListingClaim | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to top whenever the page content appears (loading → false).
  // The app uses an overflow-y-auto div as its scroll container rather than
  // the window, so we must reset both.
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
  const [bleed, setBleed] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      // Find the scrollable parent (the main content area)
      let scrollParent: HTMLElement | null = el.parentElement;
      while (scrollParent && scrollParent !== document.body) {
        const ov = window.getComputedStyle(scrollParent).overflowY;
        if (ov === "auto" || ov === "scroll") break;
        scrollParent = scrollParent.parentElement;
      }
      if (!scrollParent || scrollParent === document.body) {
        scrollParent = el.parentElement;
      }
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const paddingLeft = parseFloat(window.getComputedStyle(el).paddingLeft) || 0;
        setBleed({
          left: elRect.left - parentRect.left + paddingLeft,
          width: scrollParent.clientWidth,
        });
      }
    };
    measure();
    // Re-measure after a frame in case layout wasn't fully settled
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [loading, service]);

  // Fetch service detail (skip if session cache already provided data)
  useEffect(() => {
    if (!serviceId) return;
    if (cachedService) {
      return;
    }
    setLoading(true);
    setError(null);

    fetch(`${SB_API_BASE}/services/${serviceId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Service not found");
        return res.json();
      })
      .then(async (data) => {
        const claimStatus = await fetch(`/api/claims/service/${serviceId}/status`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null);
        const mergedService = applyClaimStatus(data, claimStatus);
        setService(mergedService);
        if (serviceCacheKey) writeSessionCache(serviceCacheKey, mergedService);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;

    fetch(`/api/claims/service/${serviceId}/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((claimStatus: ClaimServiceStatus | null) => {
        if (!claimStatus) {
          return;
        }

        setService((currentService) => {
          if (!currentService) {
            return currentService;
          }

          const mergedService = applyClaimStatus(currentService, claimStatus);
          if (serviceCacheKey) {
            writeSessionCache(serviceCacheKey, mergedService);
          }
          return mergedService;
        });
      })
      .catch(() => {});
  }, [serviceId, serviceCacheKey]);

  // Check favorite status via API
  useEffect(() => {
    if (!serviceId || !authUser?.id) return;
    const uid = getOrCreateUserId(authUser.id);
    if (uid === 'demo-user') return;
    fetch(`${SB_API_BASE}/services/favorites?user_id=${encodeURIComponent(uid)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: number }[]) => {
        if (Array.isArray(data)) {
          setIsFavorite(data.some((s) => Number(s.id) === Number(serviceId)));
        }
      })
      .catch(() => {});
  }, [serviceId, authUser?.id]);

  // Fetch reviews
  useEffect(() => {
    if (!serviceId) return;
    fetch(`${SB_API_BASE}/services/${serviceId}/reviews`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [serviceId]);

  // Fetch provider profile and user's claims for this service
  useEffect(() => {
    if (!authUser?.id || !serviceId) return;
    const controller = new AbortController();

    const authJsonFetch = async <T,>(path: string, options?: RequestInit): Promise<T | null> => {
      const response = await fetch(path, {
        credentials: 'include',
        signal: controller.signal,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers || {}),
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    };

    const loadClaimState = async () => {
      const [profileResult, claimsResult] = await Promise.allSettled([
        authJsonFetch<ProviderProfile>(`/api/provider-profiles/${authUser.id}`),
        authJsonFetch<ListingClaim[]>(`/api/claims/my`),
      ]);

      if (profileResult.status === 'fulfilled') {
        setProviderProfile(profileResult.value ?? null);
      }

      if (claimsResult.status === 'fulfilled' && Array.isArray(claimsResult.value)) {
        const match = claimsResult.value.find((claim) => claim.service_id === Number(serviceId));
        setMyClaim(match || null);
      } else {
        setMyClaim(null);
      }
    };

    void loadClaimState();

    // Provider profile
    const pending = readPendingProviderSignup();
    if (pending) {
      void authJsonFetch<ProviderProfile>(`/api/provider-profiles`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: authUser.id,
          account_type: 'provider',
          organization_name: pending.organizationName || null,
          organization_role: pending.organizationRole || null,
        }),
      })
        .then((data) => {
          if (data) {
            setProviderProfile(data);
          }
          clearPendingProviderSignup();
        })
        .catch(() => {});
    }

    return () => {
      controller.abort();
    };
  }, [authUser?.id, serviceId, token]);

  // Fetch related services
  useEffect(() => {
    if (!service?.category_names?.length) return;
    const cat = service.category_names[0];
    fetch(`${SB_API_BASE}/services?categories=${encodeURIComponent(cat)}&limit=6`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const items = Array.isArray(data) ? data : data.results || [];
        setRelatedServices(items.filter((s: Service) => s.id !== service.id).slice(0, 4));
      })
      .catch(() => {});
  }, [service]);

  useEffect(() => {
    if (serviceId) {
      trackEvent('listing_viewed', { serviceId });
    }
  }, [serviceId]);

  const toggleFavorite = useCallback(async () => {
    if (!service) return;
    if (!authUser) {
      if (!sessionResolved) return;
      sessionStorage.setItem("streetbot:postLoginRedirect", `/directory/service/${service.id}`);
      setShowAuthModal(true);
      return;
    }
    const uid = getOrCreateUserId(authUser.id);
    try {
      const resp = await fetch(
        `${SB_API_BASE}/services/${service.id}/favorite?user_id=${encodeURIComponent(uid)}`,
        { method: isFavorite ? 'DELETE' : 'POST' },
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Failed to toggle favorite', error);
    }
  }, [service, authUser, isFavorite, sessionResolved]);

  const handleShare = useCallback(() => {
    if (!service) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: service.name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }, [service]);

  const submitReview = useCallback(async () => {
    if (!serviceId || !reviewRating || submittingReview) return;
    if (!authUser) {
      if (!sessionResolved) return;
      sessionStorage.setItem("streetbot:postLoginRedirect", `/directory/service/${serviceId}`);
      setShowAuthModal(true);
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`${SB_API_BASE}/services/${serviceId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: Number(serviceId),
          user_id: userId,
          rating: reviewRating,
          comment: reviewComment || undefined,
        }),
      });
      if (res.ok) {
        const newReview = await res.json();
        setReviews((prev) => [newReview, ...prev]);
        setReviewRating(0);
        setReviewComment("");
      }
    } catch { /* ignore */ }
    setSubmittingReview(false);
  }, [serviceId, reviewRating, reviewComment, userId, submittingReview, authUser, sessionResolved, navigate]);

  // Computed
  const galleryImages = useMemo(() => service?.gallery?.filter(Boolean) || [], [service]);
  const hasMap = Boolean(service?.latitude && service?.longitude);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: colors.textMuted }}>
        Loading...
      </div>
    );
  }

  if (error || !service) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
        <p style={{ color: colors.textMuted, fontSize: 16 }}>{error || "Service not found"}</p>
        <button
          onClick={() => navigate("/directory")}
          style={{
            padding: "10px 24px",
            borderRadius: 12,
            border: "none",
            background: colors.accent,
            color: "#000",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const sectionCard: React.CSSProperties = {
    ...glassCard,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  };

  const sectionHeader: React.CSSProperties = {
    padding: "14px 20px",
    borderBottom: `1px solid ${colors.border}`,
    fontWeight: 600,
    fontSize: 15,
    color: colors.text,
  };

  const sectionBody: React.CSSProperties = {
    padding: 20,
  };

  const logoUrl = service.logo || service.image_url;
  const hasGalleryBanner = galleryImages.length > 0;
  const bannerImg = hasGalleryBanner ? galleryImages[0] : null;

  return (
    <>
    <DirectoryNavBar isMobile={isMobile || isTablet} mobileSearchExpandable />
    <div
      ref={containerRef}
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: isMobile ? "16px 12px" : isTablet ? "20px 20px" : "24px 32px",
        paddingTop: isMobile ? 87 : isTablet ? 78 : 70,
        fontFamily: "Rubik, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ================================================================= */}
      {/* Hero / Header                                                      */}
      {/* ================================================================= */}
      {(() => {
        if (bannerImg) {
          /* ── WITH GALLERY: full-bleed banner with overlay text ── */
          const fullWidth = bleed.width || "100%";
          return (
            <div
              style={{
                position: "relative",
                width: typeof fullWidth === "number" ? fullWidth : fullWidth,
                height: isMobile ? 300 : isTablet ? 360 : 420,
                backgroundImage: `url(${bannerImg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                marginLeft: bleed.width ? -bleed.left : 0,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              {/* Gradient overlay — heavier at bottom for text readability */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.7) 100%)",
                }}
              />

              {/* Action buttons — top right */}
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  display: "flex",
                  gap: 8,
                  zIndex: 2,
                }}
              >
                <button
                  onClick={toggleFavorite}
                  aria-label="Save to favorites"
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    cursor: "pointer",
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Heart
                    size={20}
                    color={isFavorite ? "#ef4444" : "#fff"}
                    fill={isFavorite ? "#ef4444" : "none"}
                  />
                </button>
                <button
                  onClick={handleShare}
                  aria-label="Share"
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    cursor: "pointer",
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Share2 size={20} color="#fff" />
                </button>
              </div>

              {/* Bottom overlay: logo + title + rating + categories */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: isMobile ? "16px 16px 20px" : "20px 24px 24px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: isMobile ? 14 : 20,
                  zIndex: 2,
                }}
              >
                {/* Circle logo */}
                {logoUrl && (
                  <div
                    style={{
                      width: isMobile ? 80 : isTablet ? 90 : 100,
                      height: isMobile ? 80 : isTablet ? 90 : 100,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "4px solid rgba(255,255,255,0.9)",
                      background: "#fff",
                      flexShrink: 0,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt={service.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Text info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Category breadcrumb */}
                  {service.category_names && service.category_names.length > 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4, fontWeight: 500 }}>
                      {service.category_names.join(" · ")}
                    </div>
                  )}

                  <h1
                    style={{
                      fontSize: isMobile ? 22 : isTablet ? 26 : 30,
                      fontWeight: 700,
                      margin: "0 0 6px",
                      color: "#fff",
                      lineHeight: 1.2,
                      textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }}
                  >
                    {service.name}
                  </h1>

                  {/* Star rating */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      {renderStars(service.rating || 0)}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                      {service.rating?.toFixed(1) || "0.0"}
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                      ({service.rating_count || 0} reviews)
                    </span>
                  </div>

                  {/* Verified badge inline */}
                  {service.is_verified && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: "#3b82f6",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#fff",
                        marginTop: 8,
                      }}
                    >
                      <BadgeCheck size={13} />
                      Verified
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        /* ── WITHOUT GALLERY: card with centered logo ── */
        return (
          <div style={sectionCard}>
            <div
              style={{
                position: "relative",
                height: isMobile ? 200 : isTablet ? 230 : 260,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={service.name}
                  style={{
                    maxWidth: "70%",
                    maxHeight: isMobile ? 120 : 180,
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}

              {/* Action buttons */}
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  display: "flex",
                  gap: 8,
                  zIndex: 2,
                }}
              >
                <button
                  onClick={toggleFavorite}
                  aria-label="Save to favorites"
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    cursor: "pointer",
                    background: "rgba(0,0,0,0.6)",
                  }}
                >
                  <Heart
                    size={20}
                    color={isFavorite ? "#ef4444" : "#fff"}
                    fill={isFavorite ? "#ef4444" : "none"}
                  />
                </button>
                <button
                  onClick={handleShare}
                  aria-label="Share"
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    cursor: "pointer",
                    background: "rgba(0,0,0,0.6)",
                  }}
                >
                  <Share2 size={20} color="#fff" />
                </button>
              </div>

              {/* Verified badge */}
              {service.is_verified && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 14px",
                    borderRadius: 20,
                    background: "#3b82f6",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#fff",
                    zIndex: 2,
                  }}
                >
                  <BadgeCheck size={14} />
                  Verified
                </div>
              )}
            </div>

            {/* Title + Rating below logo */}
            <div style={{ padding: "24px 20px 20px", textAlign: "center" }}>
              <h1
                style={{
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: 700,
                  margin: "0 0 8px",
                  color: colors.text,
                }}
              >
                {service.name}
              </h1>

              {service.city && (
                <p style={{ fontSize: 14, color: colors.textSecondary, margin: "0 0 12px" }}>
                  {[service.city, service.province].filter(Boolean).join(", ")}
                </p>
              )}

              {/* Star rating */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {renderStars(service.rating || 0)}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
                  {service.rating?.toFixed(1) || "0.0"}
                </span>
                <span style={{ fontSize: 13, color: colors.textMuted }}>
                  ({service.rating_count || 0} reviews)
                </span>
              </div>

              {/* Category tags */}
              {service.category_names && service.category_names.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 14 }}>
                  {service.category_names.map((cat) => (
                    <span
                      key={cat}
                      style={{
                        display: "inline-flex",
                        padding: "4px 14px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: colors.accent,
                        color: "#000",
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Two-column layout on desktop */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 340px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div>
          {/* ============================================================= */}
          {/* Overview                                                        */}
          {/* ============================================================= */}
          {(service.overview || service.description) && (
            <div style={sectionCard}>
              <div style={sectionHeader}>Overview</div>
              <div style={sectionBody}>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: colors.textSecondary,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {service.overview || service.description}
                </p>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* Service Info (tags)                                             */}
          {/* ============================================================= */}
          {service.tags && service.tags.length > 0 && (
            <div style={sectionCard}>
              <div style={sectionHeader}>Service Tags</div>
              <div style={{ ...sectionBody, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[...new Set(service.tags)].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      padding: "4px 12px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 500,
                      background: "rgba(255, 214, 0, 0.15)",
                      color: colors.accent,
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* Map                                                             */}
          {/* ============================================================= */}
          {hasMap && (
            <div style={sectionCard}>
              <div style={{ ...sectionHeader, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Location</span>
                <button
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}`,
                      "_blank",
                    )
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 30,
                    padding: "0 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: colors.accent,
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  <Navigation size={12} />
                  Get Directions
                </button>
              </div>
              <iframe
                title={`Map: ${service.name}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${service.longitude! - 0.008},${service.latitude! - 0.005},${service.longitude! + 0.008},${service.latitude! + 0.005}&layer=mapnik&marker=${service.latitude},${service.longitude}`}
                style={{ width: "100%", height: 260, border: "none", display: "block" }}
                loading="lazy"
              />
            </div>
          )}

          {/* ============================================================= */}
          {/* Gallery                                                         */}
          {/* ============================================================= */}
          {galleryImages.length > 0 && (
            <div style={sectionCard}>
              <div style={sectionHeader}>Photos</div>
              <div style={{ position: "relative" }}>
                <img
                  src={galleryImages[galleryIndex]}
                  alt={`${service.name} photo ${galleryIndex + 1}`}
                  style={{
                    width: "100%",
                    height: isMobile ? 200 : 320,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setGalleryIndex((i) => (i + 1) % galleryImages.length)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      {galleryImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setGalleryIndex(i)}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            border: "none",
                            background: i === galleryIndex ? "#fff" : "rgba(255,255,255,0.4)",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {galleryImages.length > 1 && (
                <div style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto" }}>
                  {galleryImages.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Thumb ${i + 1}`}
                      onClick={() => setGalleryIndex(i)}
                      style={{
                        width: 64,
                        height: 48,
                        objectFit: "cover",
                        borderRadius: 8,
                        cursor: "pointer",
                        flexShrink: 0,
                        border: i === galleryIndex ? `2px solid ${colors.accent}` : "2px solid transparent",
                        opacity: i === galleryIndex ? 1 : 0.6,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* Reviews                                                         */}
          {/* ============================================================= */}
          <div style={sectionCard}>
            <div style={sectionHeader}>
              Reviews ({reviews.length})
            </div>
            <div style={sectionBody}>
              {/* Review form */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${colors.border}`,
                  marginBottom: reviews.length > 0 ? 20 : 0,
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: "0 0 10px" }}>
                  Leave a review
                </p>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setReviewRating(s)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 2,
                      }}
                    >
                      <Star
                        size={24}
                        color="#FFD600"
                        fill={s <= reviewRating ? "#FFD600" : "none"}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: "rgba(255,255,255,0.06)",
                    color: colors.text,
                    fontSize: 14,
                    fontFamily: "inherit",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={submitReview}
                  disabled={!reviewRating || submittingReview}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 10,
                    padding: "8px 20px",
                    borderRadius: 10,
                    border: "none",
                    background: reviewRating ? colors.accent : "rgba(255,255,255,0.1)",
                    color: reviewRating ? "#000" : colors.textMuted,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: reviewRating ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  <Send size={14} />
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </div>

              {/* Review list */}
              {reviews.map((review) => (
                <div
                  key={review.id}
                  style={{
                    padding: "14px 0",
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      {renderStars(review.rating, 14)}
                    </div>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>
                      {timeAgo(review.created_at)}
                    </span>
                  </div>
                  {review.comment && (
                    <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}

              {reviews.length === 0 && (
                <p style={{ fontSize: 14, color: colors.textMuted, margin: "12px 0 0", textAlign: "center" }}>
                  No reviews yet. Be the first to share your experience.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Right sidebar (contact info)                                       */}
        {/* ================================================================= */}
        <div>
          {/* Claim / Edit Card */}
          {authUser &&
            (() => {
              const isOwner = service.claimed_by === userId;
              const isProvider = providerProfile?.account_type === "provider";
              const hasPendingClaim = myClaim?.status === "pending";
              const claimApproved = myClaim?.status === "approved";

              let claimCardContent: React.ReactNode = null;

              if (isOwner || claimApproved || isAdmin) {
                claimCardContent = (
                  <button
                    onClick={() => navigate(`/directory/edit/${service.id}`)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "none",
                      background: "#FFD600",
                      color: "#000",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Edit Listing
                  </button>
                );
              } else if (hasPendingClaim) {
                claimCardContent = (
                  <div style={{ textAlign: "center", color: colors.textSecondary, fontSize: 14 }}>
                    Your claim is pending review.
                  </div>
                );
              } else if (isProvider && !service.claimed_by) {
                claimCardContent = (
                  <button
                    onClick={() => setShowClaimModal(true)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: `1px solid ${colors.accent}`,
                      background: "rgba(255, 214, 0, 0.1)",
                      color: colors.accent,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Claim This Listing
                  </button>
                );
              } else if (service.claimed_by) {
                claimCardContent = (
                  <div style={{ textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
                    This listing has been claimed.
                  </div>
                );
              }

              if (!claimCardContent) {
                return null;
              }

              return (
                <div style={{ ...sectionCard, padding: 20, marginBottom: 20 }}>
                  {claimCardContent}
                </div>
              );
            })()}

          {/* Contact Card */}
          <div style={sectionCard}>
            <div style={sectionHeader}>Contact Information</div>
            <div style={{ ...sectionBody, display: "flex", flexDirection: "column", gap: 14 }}>
              {service.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    color: colors.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  <MapPin size={18} color={colors.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>{service.address}</span>
                </a>
              )}

              {service.phone && (
                <a
                  href={`tel:${service.phone.replace(/\D/g, "")}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: colors.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  <Phone size={18} color={colors.accent} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{formatPhone(service.phone)}</span>
                </a>
              )}

              {service.email && (
                <a
                  href={`mailto:${service.email}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: colors.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  <Mail size={18} color={colors.accent} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 14 }}>{service.email}</span>
                </a>
              )}

              {service.website && (
                <a
                  href={service.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: colors.textSecondary,
                    textDecoration: "none",
                  }}
                >
                  <Globe size={18} color={colors.accent} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {service.website.replace(/https?:\/\//, "").replace(/\/$/, "")}
                  </span>
                </a>
              )}

              {/* Quick action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {service.phone && (
                  <a
                    href={`tel:${service.phone.replace(/\D/g, "")}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                      textDecoration: "none",
                      border: "none",
                    }}
                  >
                    <Phone size={16} />
                    Call Now
                  </a>
                )}
                {service.address && (
                  <button
                    onClick={() => {
                      const dest = service.latitude && service.longitude
                        ? `${service.latitude},${service.longitude}`
                        : encodeURIComponent(service.address || "");
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#3b82f6",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      width: "100%",
                    }}
                  >
                    <Navigation size={16} />
                    Get Directions
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hours Card */}
          {service.hours && Object.keys(service.hours).length > 0 && (
            <div style={sectionCard}>
              <div style={{ ...sectionHeader, display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={16} />
                Hours
              </div>
              <div style={{ ...sectionBody, display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(service.hours).map(([day, hours]) => (
                  <div
                    key={day}
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
                  >
                    <span style={{ textTransform: "capitalize", color: colors.textSecondary }}>{day}</span>
                    <span style={{ color: colors.text, fontWeight: 500 }}>{hours}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Related Services                                                    */}
      {/* ================================================================= */}
      {relatedServices.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 16px" }}>
            Related Services
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {relatedServices.map((s) => (
              <Link
                key={s.id}
                to={`/directory/service/${s.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    ...glassCard,
                    borderRadius: 16,
                    overflow: "hidden",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div
                    style={{
                      height: 100,
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <img
                      src={s.logo || s.image_url || "/service-logos/default.svg"}
                      alt={s.name}
                      style={{ maxWidth: "70%", maxHeight: 60, objectFit: "contain" }}
                      onError={(e) => { (e.target as HTMLImageElement).src = "/service-logos/default.svg"; }}
                    />
                  </div>
                  <div style={{ padding: 14 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: colors.text }}>
                      {s.name}
                    </h3>
                    <p style={{ fontSize: 12, color: colors.textMuted, margin: 0 }}>
                      {s.city || s.category_names?.[0] || "Service"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>

      {/* Auth Modal */}
      <AuthPopupModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Claim Modal */}
      <ClaimModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        serviceId={service.id}
        serviceName={service.name}
        serviceCity={service.city}
        token={token}
        defaultName={authUser?.name || authUser?.username || ""}
        defaultEmail={authUser?.email || ""}
        defaultRole={providerProfile?.organization_role || ""}
        defaultOrgName={providerProfile?.organization_name || ""}
        onSuccess={(claim) => {
          setMyClaim(claim);
        }}
      />
    </>
  );
}

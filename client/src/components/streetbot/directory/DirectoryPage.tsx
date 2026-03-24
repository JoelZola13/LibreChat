// Module-level prefetch — fires default search API call at import time, before mount
import './directoryPrefetch';

import { lazy, Suspense, useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useNavigate, useOutletContext, useLocation, Link } from "react-router-dom";
import type { ContextType } from '~/common';
import { isDirectory } from '~/config/appVariant';
import SiteFooter from "~/components/Chat/SiteFooter";
// useDebouncedCallback no longer needed — search debouncing handled by useDirectorySearch hook
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Heart from "lucide-react/dist/esm/icons/heart";
import Phone from "lucide-react/dist/esm/icons/phone";
import Star from "lucide-react/dist/esm/icons/star";
import Filter from "lucide-react/dist/esm/icons/filter";
import X from "lucide-react/dist/esm/icons/x";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import Grid3X3 from "lucide-react/dist/esm/icons/grid-3x3";
import LayoutList from "lucide-react/dist/esm/icons/layout-list";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import BadgeCheck from "lucide-react/dist/esm/icons/badge-check";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Utensils from "lucide-react/dist/esm/icons/utensils";
import Home from "lucide-react/dist/esm/icons/home";
import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import Scale from "lucide-react/dist/esm/icons/scale";
import Users from "lucide-react/dist/esm/icons/users";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap";
import Briefcase from "lucide-react/dist/esm/icons/briefcase";
import MapIcon from "lucide-react/dist/esm/icons/map";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import Locate from "lucide-react/dist/esm/icons/locate";
import Eye from "lucide-react/dist/esm/icons/eye";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { useServiceSuggestions } from "~/components/streetbot/shared/useServiceSuggestions";
import ServiceSuggestions from "~/components/streetbot/shared/ServiceSuggestions";
import { useGlassStyles } from "../shared/useGlassStyles";
import { useResponsive } from "../hooks/useResponsive";
import MobileMenuDrawer, { getMobileNavLinkStyle, getMobileDividerStyle, HamburgerButton } from "../shared/MobileMenuDrawer";
// readSessionCache/writeSessionCache no longer needed — Meilisearch handles caching
import { useActiveUser } from "../shared/useActiveUser";
import { useTrackPageView } from '../lib/useTrackPageView';
import { prefetchServiceDetail } from './serviceDetailPrefetch';
import { useDirectorySearch } from './useDirectorySearch';
import type { SearchHit } from './useDirectorySearch';
import { useFacetAutocomplete } from './useFacetAutocomplete';
import { isDarkTheme, useTheme } from '../shared/theme-provider';

const AuthPopupModal = lazy(() => import("../shared/AuthPopupModal"));
const DirectoryMap = lazy(() => import("./DirectoryMap"));
import DirectoryNavBar from "./DirectoryNavBar";

// =============================================================================
// Inlined geo utilities (from @/lib/geo)
// =============================================================================

interface UserLocation {
  lat: number;
  lon: number;
  radiusKm: number;
  label: string;
}

const LOCATION_STORAGE_KEY = "streetbot:location";

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

function readUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const lat =
      typeof parsed["lat"] === "number"
        ? parsed["lat"]
        : typeof parsed["latitude"] === "number"
          ? parsed["latitude"]
          : null;
    const lon =
      typeof parsed["lon"] === "number"
        ? parsed["lon"]
        : typeof parsed["longitude"] === "number"
          ? parsed["longitude"]
          : null;
    const radiusKm = typeof parsed["radiusKm"] === "number" ? parsed["radiusKm"] : 10;
    const label = typeof parsed["label"] === "string" ? parsed["label"] : "";
    if (lat === null || lon === null) return null;
    return { lat, lon, radiusKm, label };
  } catch {
    return null;
  }
}

const DISTANCE_OPTIONS = [
  { value: 5, label: "Within 5 km" },
  { value: 10, label: "Within 10 km" },
  { value: 25, label: "Within 25 km" },
  { value: 50, label: "Within 50 km" },
  { value: 100, label: "Within 100 km" },
  { value: 0, label: "Any distance" },
];

// =============================================================================
// Inlined userId utility (from @/lib/userId)
// =============================================================================

import { getOrCreateUserId } from '~/components/streetbot/shared/getOrCreateUserId';

// =============================================================================
// Types
// =============================================================================

type Service = {
  id: number;
  name: string;
  description?: string;
  overview?: string;
  city?: string;
  category_names?: string[];
  tags?: string[];
  phone?: string;
  address?: string;
  email?: string;
  website?: string;
  hours?: Record<string, string>;
  rating?: number;
  rating_count?: number;
  is_verified?: boolean;
  latitude?: number;
  longitude?: number;
  logo?: string;
  image_url?: string;
  gallery?: string[];
  distance?: number;
  service_type?: string;
  /** Meilisearch _formatted fields with highlight <em> tags and crop markers */
  _formatted?: {
    name?: string;
    overview?: string;
    description?: string;
    [key: string]: unknown;
  };
};

type ViewMode = "grid" | "list" | "map";

type FilterState = {
  search: string;
  categories: string[];
  serviceTypes: string[];
  agesServed: string[];
  gendersServed: string[];
  city: string;
  maxDistance: number;
};

// =============================================================================
// Constants
// =============================================================================

const CATEGORY_OPTIONS = [
  { value: "Shelters", label: "Shelters", icon: Home },
  { value: "Health", label: "Health", icon: Stethoscope },
  { value: "Food", label: "Food", icon: Utensils },
  { value: "Programs", label: "Programs", icon: GraduationCap },
  { value: "Legal", label: "Legal", icon: Scale },
  { value: "Employment", label: "Employment", icon: Briefcase },
];

const SERVICES_API_URL = `${SB_API_BASE}/services`;
const DIRECTORY_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const DIRECTORY_INITIAL_BATCH = 12;
const DIRECTORY_SEARCH_MIN_BATCH_MOBILE = 24;
const DIRECTORY_SEARCH_MIN_BATCH_DESKTOP = 48;
const DIRECTORY_SEARCH_MAX_BATCH = 200;
const DIRECTORY_MAP_BATCH = 2000; // fetch all services when in map view
const DIRECTORY_PRIORITY_CARD_COUNT_MOBILE = 2;
const DIRECTORY_PRIORITY_CARD_COUNT_DESKTOP = 4;
const DIRECTORY_PROGRESSIVE_FETCH_ENABLED =
  import.meta.env.VITE_DIRECTORY_PROGRESSIVE_FETCH_ENABLED !== 'false';

function getDirectorySearchBatchSize() {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
    return DIRECTORY_SEARCH_MIN_BATCH_MOBILE;
  }
  return DIRECTORY_SEARCH_MIN_BATCH_DESKTOP;
}

const CATEGORY_ICON_MAP = new Map(CATEGORY_OPTIONS.map((c) => [c.value, c.icon]));
const getCategoryIcon = (category: string) => CATEGORY_ICON_MAP.get(category) || Building2;

// =============================================================================
// Inlined ServiceCard component (replaces ExpandableServiceCard)
// =============================================================================

type ServiceCardColors = ReturnType<typeof useGlassStyles>['colors'] & {
  accentText: string;
};

type ServiceCardProps = {
  service: Service;
  onToggleFavorite: (id: number) => void;
  onShare: (id: number, name: string) => void;
  onGetHelp?: (service: Service) => void;
  onPreview: (id: number) => void;
  isFavorite: boolean;
  priorityMedia?: boolean;
  compactMobile?: boolean;
  isMobileCard?: boolean;
  colors: ServiceCardColors;
  CategoryIcon: React.ComponentType<{ size: number; color: string }>;
  formatPhone: (phone?: string) => string;
};

/* ── Pagination ────────────────────────────────────────────────────── */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  colors,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  colors: { accent: string; text: string; cardBg: string; border: string };
}) {
  // Build page numbers: 1 2 3 ... last
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    // Always show first 3, last, and pages around current
    const near = new Set<number>();
    near.add(1); near.add(2); near.add(3);
    near.add(totalPages);
    near.add(currentPage);
    if (currentPage > 1) near.add(currentPage - 1);
    if (currentPage < totalPages) near.add(currentPage + 1);
    const sorted = Array.from(near).filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) pages.push('...');
      pages.push(sorted[i]);
    }
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 44, height: 44, borderRadius: '50%', border: 'none',
    cursor: 'pointer', fontSize: 16, fontWeight: 600, transition: 'all 0.15s',
    background: 'transparent', color: colors.text,
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 32 }}>
      {/* Previous arrow */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{ ...btnBase, opacity: currentPage === 1 ? 0.3 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}
        aria-label="Previous page"
      >
        ←
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} style={{ width: 44, textAlign: 'center', color: colors.text, fontSize: 16, userSelect: 'none' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              ...btnBase,
              background: p === currentPage ? colors.accent : 'transparent',
              color: p === currentPage ? '#000' : colors.text,
              fontWeight: p === currentPage ? 700 : 500,
            }}
            aria-label={`Page ${p}`}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}

      {/* Next arrow */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{ ...btnBase, opacity: currentPage === totalPages ? 0.3 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}
        aria-label="Next page"
      >
        →
      </button>
    </div>
  );
}

const ServiceCard = memo(function ServiceCard({
  service,
  onToggleFavorite,
  onShare,
  onGetHelp,
  onPreview,
  isFavorite,
  priorityMedia = false,
  compactMobile = false,
  isMobileCard = false,
  colors,
  CategoryIcon,
  formatPhone,
}: ServiceCardProps) {
  return (
    <div
      className="service-card"
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glassShadow,
        borderRadius: compactMobile ? "20px" : "24px",
        overflow: "hidden",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* Logo Banner */}
      <div
        className="service-card__banner"
        style={{
          position: "relative",
          height: compactMobile ? "130px" : isMobileCard ? "130px" : "180px",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <img
          src={service.logo || "/service-logos/default.svg"}
          alt={service.name}
          loading={priorityMedia ? "eager" : "lazy"}
          decoding="async"
          width={200}
          height={140}
          style={{
            maxWidth: "85%",
            maxHeight: compactMobile ? "90px" : isMobileCard ? "100px" : "140px",
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/service-logos/default.svg";
          }}
        />

        {/* Category Badge */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: compactMobile ? "5px 10px" : "6px 12px",
            borderRadius: "20px",
            fontSize: compactMobile ? "11px" : "12px",
            fontWeight: 600,
            color: "#000",
            background: colors.accent,
          }}
        >
          <CategoryIcon size={14} color="#000" />
          {service.category_names?.[0] || "Service"}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            display: "flex",
            gap: "6px",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (service.id <= 0) return;
              onToggleFavorite(service.id);
            }}
            aria-label="Save to favorites"
            style={{
              height: compactMobile ? "34px" : "36px",
              width: compactMobile ? "34px" : "36px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              cursor: "pointer",
              background: "rgba(0, 0, 0, 0.6)",
              transition: "transform 0.15s ease",
            }}
          >
            <Heart
              size={18}
              color={isFavorite ? "#ef4444" : "#fff"}
              fill={isFavorite ? "#ef4444" : "none"}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (service.id <= 0) return;
              onShare(service.id, service.name);
            }}
            aria-label="Share service"
            style={{
              height: compactMobile ? "34px" : "36px",
              width: compactMobile ? "34px" : "36px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              cursor: "pointer",
              background: "rgba(0, 0, 0, 0.6)",
              transition: "transform 0.15s ease",
            }}
          >
            <Share2 size={18} color="#fff" />
          </button>
        </div>

        {/* Verified Badge */}
        {service.is_verified && (
          <div
            style={{
              position: "absolute",
              bottom: "-14px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: "#3b82f6",
              fontSize: "11px",
              fontWeight: 600,
              color: "#fff",
            }}
          >
            <BadgeCheck size={14} color="#fff" />
            Verified
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: compactMobile ? "12px" : isMobileCard ? "14px" : "20px" }}>
        <h3
          style={{
            fontSize: compactMobile ? "1rem" : isMobileCard ? "1.05rem" : "1.1rem",
            fontWeight: 700,
            margin: isMobileCard ? "0 0 4px 0" : "0 0 8px 0",
            textAlign: "center",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
        >
          <Link
            to={`/directory/service/${service.id}`}
            style={{
              color: colors.text,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = colors.accent; prefetchServiceDetail(service.id); }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = colors.text; }}
          >
            {service.name}
          </Link>
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: compactMobile ? "12px" : isMobileCard ? "13px" : "14px",
            lineHeight: 1.5,
            marginBottom: isMobileCard ? "8px" : "12px",
            display: "-webkit-box",
            WebkitLineClamp: isMobileCard ? 1 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textAlign: "center",
            color: colors.textSecondary,
          }}
        >
          {/* Prefer _formatted (cropped+highlighted) over raw fields */}
          {(() => {
            const fmt = service._formatted;
            const formattedText = fmt?.overview || fmt?.description;
            if (formattedText) {
              return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
            }
            return service.description || "Community service provider";
          })()}
        </p>

        {/* Tags */}
        {service.tags && service.tags.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              justifyContent: "center",
              marginBottom: "14px",
            }}
          >
            {service.tags.slice(0, isMobileCard ? 3 : 4).map((tag, idx) => (
              <span
                key={idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: 500,
                  background: "rgba(255, 214, 0, 0.15)",
                  color: colors.accent,
                }}
              >
                {tag}
              </span>
            ))}
            {service.tags.length > (isMobileCard ? 3 : 4) && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  background: "rgba(255,255,255,0.1)",
                  color: colors.textMuted,
                }}
              >
                +{service.tags.length - (isMobileCard ? 3 : 4)}
              </span>
            )}
          </div>
        )}

        {/* Contact Info Summary */}
        {isMobileCard ? (
          <div style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: colors.textSecondary, lineHeight: 1.3 }}>
              <MapPin size={13} color={colors.accent} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {service.address || service.city || "Location not available"}
                {service.distance !== undefined && ` · ${formatDistance(service.distance)}`}
              </span>
            </div>
            {service.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                <Phone size={13} color={colors.accent} style={{ flexShrink: 0 }} />
                <a
                  href={`tel:${service.phone.replace(/\D/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: colors.accentText, textDecoration: "none", fontWeight: 500 }}
                >
                  {formatPhone(service.phone)}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: compactMobile ? "12px" : "14px",
              borderRadius: "12px",
              marginBottom: "14px",
              background: "rgba(255, 255, 255, 0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <MapPin size={16} color={colors.accent} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: "13px", color: colors.text, lineHeight: 1.4 }}>
                {service.address || service.city || "Location not available"}
              </span>
            </div>
            {service.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Phone size={16} color={colors.accent} style={{ flexShrink: 0 }} />
                <a
                  href={`tel:${service.phone.replace(/\D/g, "")}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: "13px",
                    color: colors.accentText,
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {formatPhone(service.phone)}
                </a>
              </div>
            )}
            {service.distance !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Navigation size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: 600 }}>
                  {formatDistance(service.distance)} away
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            paddingTop: isMobileCard ? "8px" : "12px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          {isMobileCard ? (
            /* Mobile: compact single-row buttons */
            <>
              <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                {service.phone && (
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${service.phone}`; }}
                    title={`Call ${service.phone}`}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      padding: "7px 0", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "none", cursor: "pointer",
                    }}
                  >
                    <Phone size={13} /> Call
                  </button>
                )}
                {service.address && (
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(service.address || "")}`, "_blank"); }}
                    title="Get directions"
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      padding: "7px 0", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "none", cursor: "pointer",
                    }}
                  >
                    <Navigation size={13} /> Directions
                  </button>
                )}
                {onGetHelp && (
                <button
                  onClick={(e) => { e.stopPropagation(); onGetHelp(service); }}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                    padding: "7px 0", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                    background: "rgba(255, 214, 0, 0.15)", color: colors.accent, border: "none", cursor: "pointer",
                  }}
                >
                  <MessageCircle size={13} /> Help
                </button>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onPreview(service.id); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                  width: "100%", padding: "5px 0", marginTop: "4px",
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: "11px", fontWeight: 500, color: colors.textMuted,
                }}
              >
                <Eye size={12} /> Quick preview
              </button>
            </>
          ) : (
            /* Desktop / Tablet: original layout */
            <div
              style={{
                display: "flex",
                alignItems: compactMobile ? "stretch" : "center",
                justifyContent: compactMobile ? "flex-start" : "space-between",
                flexDirection: compactMobile ? "column" : "row",
                gap: compactMobile ? "10px" : 0,
              }}
            >
              <div
                style={{
                  display: compactMobile ? "grid" : "flex",
                  gridTemplateColumns: compactMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
                  width: compactMobile ? "100%" : "auto",
                  gap: "8px",
                  flexWrap: compactMobile ? "nowrap" : "wrap",
                }}
              >
                {service.phone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `tel:${service.phone}`;
                    }}
                    title={`Call ${service.phone}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 600,
                      width: compactMobile ? "100%" : "auto",
                      justifyContent: "center",
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Phone size={14} />
                    Call
                  </button>
                )}
                {service.address && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const encoded = encodeURIComponent(service.address || "");
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
                        "_blank",
                      );
                    }}
                    title="Get directions"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 600,
                      width: compactMobile ? "100%" : "auto",
                      justifyContent: "center",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#3b82f6",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Navigation size={14} />
                    Directions
                  </button>
                )}
                {onGetHelp && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGetHelp(service);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    width: compactMobile ? "100%" : "auto",
                    justifyContent: "center",
                    background: "rgba(255, 214, 0, 0.15)",
                    color: colors.accent,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <MessageCircle size={14} />
                  Get Help
                </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(service.id);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    width: compactMobile ? "100%" : "auto",
                    justifyContent: "center",
                    background: "rgba(59, 130, 246, 0.15)",
                    color: "#3b82f6",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Eye size={14} />
                  Preview
                </button>
              </div>

              {!compactMobile && service.rating && service.rating > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Star size={14} color={colors.accent} fill={colors.accent} />
                  <span style={{ fontSize: "13px", fontWeight: 500, color: colors.text }}>
                    {service.rating.toFixed(1)}
                  </span>
                  <span style={{ fontSize: "12px", color: colors.textMuted }}>
                    ({service.rating_count})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// ServicePreviewOverlay — "Hierarchy of Reveal" level 2
// Shows expanded service details + mini map when Preview button is clicked
// =============================================================================

type ServicePreviewOverlayProps = {
  service: Service;
  onClose: () => void;
  colors: ServiceCardColors;
  dark: boolean;
  userLocation?: UserLocation | null;
  isMobile: boolean;
  formatPhone: (phone?: string) => string;
};

const ServicePreviewOverlay = memo(function ServicePreviewOverlay({
  service,
  onClose,
  colors,
  dark,
  userLocation,
  isMobile,
  formatPhone,
}: ServicePreviewOverlayProps) {
  const navigate = useNavigate();
  const [mobileSheetMaxHeight, setMobileSheetMaxHeight] = useState<number | null>(null);

  // Escape key closes overlay
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // iOS/Safari can report vh larger than the visible area when browser UI is shown.
  // Use visualViewport height so the sheet header never gets clipped off-screen.
  useEffect(() => {
    if (!isMobile) return;

    const updateSheetHeight = () => {
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight;
      setMobileSheetMaxHeight(Math.max(320, Math.floor(viewportHeight - 8)));
    };

    updateSheetHeight();

    window.addEventListener("resize", updateSheetHeight);
    window.addEventListener("orientationchange", updateSheetHeight);
    window.visualViewport?.addEventListener("resize", updateSheetHeight);

    return () => {
      window.removeEventListener("resize", updateSheetHeight);
      window.removeEventListener("orientationchange", updateSheetHeight);
      window.visualViewport?.removeEventListener("resize", updateSheetHeight);
    };
  }, [isMobile]);

  const CategoryIcon = getCategoryIcon(service.category_names?.[0] || "");
  const mapServices = useMemo(() => [service], [service]);
  const mapColors = useMemo(
    () => ({
      surface: colors.surface,
      border: colors.border,
      text: colors.text,
      textSecondary: colors.textSecondary,
      accent: colors.accent,
    }),
    [colors],
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : "min(820px, 92vw)",
          maxHeight: isMobile
            ? (mobileSheetMaxHeight ? `${mobileSheetMaxHeight}px` : "92vh")
            : "88vh",
          background: dark ? "#1a1b26" : "#fff",
          borderRadius: isMobile ? "20px 20px 0 0" : "20px",
          border: `1px solid ${colors.border}`,
          boxShadow: `0 24px 80px rgba(0,0,0,${dark ? "0.5" : "0.2"})`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Drag indicator (mobile bottom sheet affordance) */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2, flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }} />
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "10px 16px" : "18px 24px",
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>
            Service Preview
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isMobile && (
              <button
                onClick={() => {
                  onClose();
                  navigate("/home");
                }}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  border: "none",
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Home
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={16} color={colors.text} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {/* Top section: Info + Map side by side (stacked on mobile) */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 0,
            }}
          >
            {/* Left: Service info */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: isMobile ? "20px" : "24px",
              }}
            >
              {/* Logo + Name row */}
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "16px" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "14px",
                    background: "#fff",
                    border: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={service.logo || "/service-logos/default.svg"}
                    alt={service.name}
                    style={{
                      maxWidth: "90%",
                      maxHeight: "90%",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/service-logos/default.svg";
                    }}
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      margin: "0 0 4px 0",
                      lineHeight: 1.3,
                    }}
                  >
                    <Link
                      to={`/directory/service/${service.id}`}
                      style={{
                        color: colors.accentText,
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.textDecoration = "underline";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.textDecoration = "none";
                      }}
                    >
                      {service.name}
                    </Link>
                  </h3>

                  {/* Category + Rating */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#000",
                        background: colors.accent,
                      }}
                    >
                      <CategoryIcon size={13} color="#000" />
                      {service.category_names?.[0] || "Service"}
                    </span>
                    {service.is_verified && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#3b82f6",
                        }}
                      >
                        <BadgeCheck size={14} color="#3b82f6" />
                        Verified
                      </span>
                    )}
                    {service.rating != null && service.rating > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "13px" }}>
                        <Star size={13} color={colors.accent} fill={colors.accent} />
                        <span style={{ fontWeight: 600, color: colors.text }}>{service.rating.toFixed(1)}</span>
                        {service.rating_count != null && (
                          <span style={{ color: colors.textMuted, fontSize: "12px" }}>
                            ({service.rating_count} reviews)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {(service.description || service.overview) && (
                <p
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: colors.textSecondary,
                    margin: "0 0 16px 0",
                    display: "-webkit-box",
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {/* Prefer _formatted (cropped+highlighted) over raw fields */}
                  {(() => {
                    const fmt = service._formatted;
                    const formattedText = fmt?.overview || fmt?.description;
                    if (formattedText) {
                      return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
                    }
                    return service.description || service.overview;
                  })()}
                </p>
              )}

              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginBottom: "16px",
                  }}
                >
                  {service.tags.slice(0, 6).map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        fontSize: "11px",
                        fontWeight: 500,
                        background: "rgba(255, 214, 0, 0.12)",
                        color: colors.accent,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  {service.tags.length > 6 && (
                    <span style={{ padding: "3px 10px", borderRadius: "9999px", fontSize: "11px", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: colors.textMuted }}>
                      +{service.tags.length - 6}
                    </span>
                  )}
                </div>
              )}

              {/* Contact details */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "14px",
                  borderRadius: "12px",
                  background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                {service.address && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <MapPin size={15} color={colors.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: "13px", color: colors.text, lineHeight: 1.4 }}>
                      {service.address}
                    </span>
                  </div>
                )}
                {service.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Phone size={15} color={colors.accent} style={{ flexShrink: 0 }} />
                    <a
                      href={`tel:${service.phone.replace(/\D/g, "")}`}
                      style={{ fontSize: "13px", color: colors.accentText, textDecoration: "none", fontWeight: 500 }}
                    >
                      {formatPhone(service.phone)}
                    </a>
                  </div>
                )}
                {service.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <MessageCircle size={15} color={colors.accent} style={{ flexShrink: 0 }} />
                    <a
                      href={`mailto:${service.email}`}
                      style={{ fontSize: "13px", color: colors.accentText, textDecoration: "none", fontWeight: 500 }}
                    >
                      {service.email}
                    </a>
                  </div>
                )}
                {service.distance != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Navigation size={15} color="#22c55e" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: 600 }}>
                      {formatDistance(service.distance)} away
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "16px",
                }}
              >
                {service.phone && (
                  <a
                    href={`tel:${service.phone.replace(/\D/g, "")}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                      textDecoration: "none",
                    }}
                  >
                    <Phone size={14} />
                    Call
                  </a>
                )}
                {service.address && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(service.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#3b82f6",
                      textDecoration: "none",
                    }}
                  >
                    <Navigation size={14} />
                    Directions
                  </a>
                )}
                <button
                  onClick={() => navigate(`/directory/service/${service.id}`)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: colors.accent,
                    color: "#000",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  View Full Details
                </button>
              </div>
            </div>

            {/* Right: Mini map */}
            {service.latitude != null && service.longitude != null && (
              <div
                style={{
                  width: isMobile ? "100%" : 340,
                  height: isMobile ? 200 : "auto",
                  minHeight: isMobile ? 200 : 300,
                  flexShrink: 0,
                  borderLeft: isMobile ? "none" : `1px solid ${colors.border}`,
                  borderTop: isMobile ? `1px solid ${colors.border}` : "none",
                }}
              >
                <Suspense
                  fallback={
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: colors.textMuted,
                        fontSize: "13px",
                      }}
                    >
                      Loading map…
                    </div>
                  }
                >
                  <DirectoryMap
                    services={mapServices}
                    colors={mapColors}
                    userLocation={userLocation}
                    selectedServiceId={service.id}
                    style={{ width: "100%", height: "100%", borderRadius: 0 }}
                    dark={dark}
                  />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export default function DirectoryPage() {
  useTrackPageView('directory');
  const navigate = useNavigate();
  const location = useLocation();
  const { activeUser, resolved: sessionResolved } = useActiveUser();
  const { theme, setTheme } = useTheme();
  const dark = isDarkTheme(theme);
  const toggleTheme = useCallback(() => setTheme(dark ? 'light' : 'dark'), [dark, setTheme]);
  const navTextColor = dark ? '#fff' : '#1a1c24';
  const userInitial =
    activeUser?.name?.charAt(0)?.toUpperCase() ||
    activeUser?.username?.charAt(0)?.toUpperCase() ||
    "?";

  // Read URL params for initial state (from home page category clicks, etc.)
  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [filters, setFilters] = useState<FilterState>(() => ({
    search: "",
    categories: urlParams.get("categories") ? urlParams.get("categories")!.split(",").filter(Boolean) : [],
    serviceTypes: [],
    agesServed: [],
    gendersServed: [],
    city: urlParams.get("city") || "",
    maxDistance: 0,
  }));

  const [searchTerm, setSearchTerm] = useState(() => urlParams.get("q") || "");
  // Separate city input text (what the user types) from confirmed city filter (sent to API).
  // This prevents partial text like "tor" from triggering a search filter before a dropdown selection.
  const [cityInput, setCityInput] = useState(() => urlParams.get("city") || "");
  const { suggestions, showSuggestions, closeSuggestions, openSuggestions } = useServiceSuggestions({
    query: searchTerm,
    city: filters.city || undefined,
  });
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const [selectedService, setSelectedService] = useState<number | string | null>(null);
  const [showMapList, setShowMapList] = useState(true);
  const [previewServiceId, setPreviewServiceId] = useState<number | null>(null);
  // All services fetched directly from /sbapi/services for the map (bypasses Meilisearch maxTotalHits cap)
  const [allMapServices, setAllMapServices] = useState<Service[] | null>(null);
  const allMapServicesFetchedRef = useRef(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["categories", "serviceTypes", "agesServed", "gendersServed", "distance"]),
  );

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [nearMeActive, setNearMeActive] = useState(false);

  // Close city dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setShowCityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectSuggestion = useCallback((id: number) => {
    closeSuggestions();
    navigate(`/directory/service/${id}`);
  }, [navigate, closeSuggestions]);

  const selectCity = useCallback((cityName: string) => {
    setCityInput(cityName);
    setFilters((prev) => ({ ...prev, city: cityName }));
    setShowCityDropdown(false);
  }, []);

  // When in map view, fetch ALL results from Meilisearch so the map shows
  // every service (not just the first page).  The direct `/sbapi/services`
  // endpoint (allMapServices) is the preferred path, but it may be
  // inaccessible in some environments — this ensures full coverage either way.
  const isMapActive = viewMode === 'map' || showFullMap;
  // For map: request 200 per page, progressively load up to 2000 total
  // perPage must be < progressiveLimit for progressive loading to kick in
  const effectivePerPage = isMapActive ? DIRECTORY_SEARCH_MAX_BATCH : ITEMS_PER_PAGE;
  const effectiveProgressiveLimit = isMapActive ? DIRECTORY_MAP_BATCH : getDirectorySearchBatchSize();

  // Meilisearch-powered instant search — uses server-side pagination
  const searchResult = useDirectorySearch({
    query: searchTerm || filters.search,
    city: filters.city || undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    serviceTypes: filters.serviceTypes.length > 0 ? filters.serviceTypes : undefined,
    agesServed: filters.agesServed.length > 0 ? filters.agesServed : undefined,
    gendersServed: filters.gendersServed.length > 0 ? filters.gendersServed : undefined,
    lat: nearMeActive && userLocation ? userLocation.lat : undefined,
    lng: nearMeActive && userLocation ? userLocation.lon : undefined,
    radiusKm: nearMeActive && userLocation && filters.maxDistance > 0 ? filters.maxDistance : undefined,
    sort: nearMeActive && userLocation ? undefined : undefined, // distance sort is automatic when geo is present
    page: isMapActive ? 0 : currentPage - 1,
    perPage: effectivePerPage,
    facets: ['category_names', 'city', 'service_type', 'ages_served', 'gender_served'],
    progressive: isMapActive ? DIRECTORY_PROGRESSIVE_FETCH_ENABLED : false,
    progressiveLimit: effectiveProgressiveLimit,
    cacheTtlMs: DIRECTORY_SEARCH_CACHE_TTL_MS,
  });

  const transformService = (svc: Record<string, unknown>): Service => {
    // Extract structured contact info when available
    const contact = svc.contact_structured as Record<string, unknown> | null | undefined;
    // The API sometimes puts the address in the `phone` top-level field;
    // prefer contact_structured fields for accuracy.
    const rawPhone = svc.phone as string | undefined;
    const structuredPhone = (contact?.phone_secondary as string) || (contact?.phone as string) || undefined;
    // Use structured phone if the top-level phone looks like an address
    const isPhoneLikeAddress = rawPhone && /\d{2,}\s+\w/.test(rawPhone) && rawPhone.includes(",");
    const phone = structuredPhone || (isPhoneLikeAddress ? undefined : rawPhone);

    const address =
      (svc.address as string) ||
      (contact?.address as string) ||
      (isPhoneLikeAddress ? rawPhone : undefined);

    // Meilisearch provides _geo and _geoDistance
    const geo = svc._geo as { lat: number; lng: number } | undefined;
    const geoDistance = svc._geoDistance as number | undefined;
    const lat = geo?.lat ?? (svc.latitude as number | undefined);
    const lng = geo?.lng ?? (svc.longitude as number | undefined);
    // _geoDistance is in meters, convert to km
    const distance = geoDistance !== undefined ? geoDistance / 1000 : undefined;

    return {
      id: svc.id as number,
      name: (svc.name as string) || "Unknown Service",
      description: (svc.overview as string) || (svc.description as string) || undefined,
      city: svc.city as string | undefined,
      category_names: svc.category_names as string[] | undefined,
      tags: svc.tags as string[] | undefined,
      phone,
      address,
      email: (svc.email as string) || (contact?.email as string) || undefined,
      website: (svc.website as string) || (contact?.website_url as string) || undefined,
      hours: svc.hours as Record<string, string> | undefined,
      rating: svc.rating as number | undefined,
      rating_count: svc.rating_count as number | undefined,
      is_verified: svc.is_verified as boolean | undefined,
      latitude: lat,
      longitude: lng,
      logo:
        (svc.image_url as string) ||
        (svc.logo_url as string) ||
        (svc.logo as string) ||
        undefined,
      distance,
      service_type: typeof svc.service_type === 'string' ? svc.service_type : undefined,
      _formatted: svc._formatted as Service['_formatted'],
    };
  };

  // Derive city filter options from Meilisearch facets
  useEffect(() => {
    const cityFacets = searchResult.facets?.city;
    if (cityFacets && Object.keys(cityFacets).length > 0) {
      setCityOptions(Object.keys(cityFacets).sort());
    }
  }, [searchResult.facets]);

  const shareService = useCallback(async (serviceId: number, serviceName: string) => {
    const shareUrl = `${window.location.origin}/directory/${serviceId}`;
    const shareText = `Check out ${serviceName} on Street Voices`;
    try {
      if (navigator.share) {
        await navigator.share({ title: serviceName, text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${shareText}: ${shareUrl}`);
        alert("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    if (!activeUser?.id) {
      setFavorites(new Set());
      return;
    }
    try {
      const base = SERVICES_API_URL.replace(/\/$/, "");
      const userId = getOrCreateUserId(activeUser.id);
      const resp = await fetch(`${base}/favorites?user_id=${encodeURIComponent(userId)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) {
        setFavorites(new Set(data.map((svc: { id: number }) => Number(svc.id))));
      }
    } catch {
      setFavorites(new Set());
    }
  }, [activeUser?.id]);

  // Load user location from settings
  useEffect(() => {
    const storedLocation = readUserLocation();
    if (storedLocation) {
      setUserLocation(storedLocation);
      setFilters((prev) => ({ ...prev, maxDistance: storedLocation.radiusKm }));
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setNearMeActive(false);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json();
          const newLocation: UserLocation = {
            lat: latitude,
            lon: longitude,
            radiusKm: userLocation?.radiusKm ?? 10,
            label:
              data.address?.city ||
              data.address?.town ||
              data.display_name?.split(",")[0] ||
              `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          };
          setUserLocation(newLocation);
          localStorage.setItem("streetbot:location", JSON.stringify(newLocation));
        } catch {
          const newLocation: UserLocation = {
            lat: latitude,
            lon: longitude,
            radiusKm: userLocation?.radiusKm ?? 10,
            label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          };
          setUserLocation(newLocation);
          localStorage.setItem("streetbot:location", JSON.stringify(newLocation));
        }
        setNearMeActive(true);
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to get your location. Please set it in Settings.");
        setNearMeActive(false);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, [userLocation?.radiusKm]);

  // Responsive
  const { isMobile, isTablet, isDesktop, isLargeDesktop, width: viewportWidth } = useResponsive();
  const isCompactMobile = isMobile && viewportWidth <= 390;
  const isNarrowMobile = isMobile && viewportWidth <= 360;
  const isUltraNarrowMobile = isMobile && viewportWidth <= 320;
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!isMobile && mobileSearchOpen) {
      setMobileSearchOpen(false);
    }
  }, [isMobile, mobileSearchOpen]);

  // Sidebar-aware nav offset for fixed positioning
  const { navVisible } = (useOutletContext<ContextType>() ?? { navVisible: false });
  const [sidebarMinimized, setSidebarMinimized] = useState(true);
  useEffect(() => {
    setSidebarMinimized(JSON.parse(localStorage.getItem('sidebarMinimized') ?? 'true'));
  }, []);
  const navLeft = (isMobile || isTablet) ? 0 : isDirectory ? 0 : navVisible ? (sidebarMinimized ? 80 : 275) : 0;

  // Colors from shared glass design system
  const { colors: baseColors, gradientOrbs } = useGlassStyles();
  // Extend with page-specific color aliases
  const colors = useMemo(
    () => ({
      ...baseColors,
      accentText: baseColors.accent,
    }),
    [baseColors],
  );

  // Transform Meilisearch hits to Service objects
  // Meilisearch handles filtering/sorting server-side, so no client-side filtering needed
  const services = useMemo(() => {
    return searchResult.hits.map((hit) => transformService(hit as unknown as Record<string, unknown>));
  }, [searchResult.hits]);

  const isResultsLoading =
    (!searchResult.resolved && services.length === 0) ||
    (searchResult.loading && services.length === 0);

  // For client-side distance calc when geo search is NOT active (fallback)
  const filteredServices = useMemo(() => {
    if (!userLocation) return services;

    // Always compute client-side distance when the backend didn't provide one
    const withDistance = services.map((service) => {
      if (service.latitude && service.longitude && service.distance === undefined) {
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          service.latitude,
          service.longitude,
        );
        return { ...service, distance: dist };
      }
      return service;
    });

    // When Near Me is active, sort by distance (closest first)
    if (nearMeActive) {
      return [...withDistance].sort(
        (a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER),
      );
    }

    return withDistance;
  }, [services, userLocation, nearMeActive]);

  // Category facet counts from Meilisearch
  const categoryFacets = searchResult.facets?.category_names || {};

  // Dynamic category options: merge static icons with all facet categories
  const dynamicCategoryOptions = useMemo(() => {
    const facetEntries = Object.entries(categoryFacets)
      .filter(([name]) => name.length > 0)
      .sort((a, b) => b[1] - a[1]);
    if (facetEntries.length === 0) return CATEGORY_OPTIONS;
    // Build a set of facet names for quick lookup
    const facetNames = new Set(facetEntries.map(([name]) => name));
    // Start with static options that have results, preserving their icons
    const result = CATEGORY_OPTIONS
      .filter((opt) => facetNames.has(opt.value))
      .map((opt) => ({ value: opt.value, label: opt.label, icon: opt.icon }));
    const staticValues = new Set(CATEGORY_OPTIONS.map((opt) => opt.value));
    // Add any facet categories not in the static list (with generic icon)
    for (const [name] of facetEntries) {
      if (!staticValues.has(name)) {
        result.push({ value: name, label: name, icon: getCategoryIcon(name) });
      }
    }
    return result;
  }, [categoryFacets]);

  // City facets for autocomplete — sorted by count descending
  const cityFacetList = useMemo(() => {
    const raw = searchResult.facets?.city || {};
    return Object.entries(raw)
      .filter(([name]) => name.length > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [searchResult.facets]);

  // Server-side facet autocomplete for city (typo tolerant)
  const { hits: cityFacetHits } = useFacetAutocomplete({
    facet: 'city',
    query: cityInput,
    searchQuery: searchTerm,
    debounceMs: 100,
    max: 12,
    enabled: showCityDropdown && cityInput.length > 0,
  });

  // Merge: when user is typing, prefer server-side facet hits (typo tolerant);
  // when empty, show top cities from search result facets
  const filteredCityFacets = useMemo(() => {
    if (cityInput.length > 0 && cityFacetHits.length > 0) {
      return cityFacetHits.map((h) => [h.value, h.count] as [string, number]);
    }
    // Fall back to client-side filtering of search facets
    if (!cityInput) return cityFacetList.slice(0, 12);
    const q = cityInput.toLowerCase();
    return cityFacetList.filter(([name]) => name.toLowerCase().includes(q)).slice(0, 12);
  }, [cityFacetList, cityInput, cityFacetHits]);

  const totalPages = Math.max(1, Math.ceil((searchResult.total || 0) / ITEMS_PER_PAGE));
  // For non-map views, searchResult.hits already contains only the current page's items (server-side pagination).
  // For map views, filteredServices contains progressively loaded items — show all.
  const visibleServices = isMapActive ? filteredServices : filteredServices.slice(0, ITEMS_PER_PAGE);

  const mapServices = useMemo(() => {
    // allMapServices comes from /sbapi/services (no service_type field).
    // filteredServices comes from Meilisearch (has service_type, but capped by maxTotalHits/pagination).
    // Use allMapServices when possible for uncapped results; fall back to filteredServices
    // only when filters require fields only available in Meilisearch (serviceTypes).
    // Distance filtering is done client-side via Haversine so we keep the full dataset.
    const needsMeilisearch = filters.serviceTypes.length > 0;
    const useAll = !needsMeilisearch && allMapServices && allMapServices.length > 0;
    const base = useAll ? allMapServices : filteredServices;
    if (base === filteredServices) return base; // already filtered by Meilisearch

    // Apply client-side filters to allMapServices
    let result = base;
    if (filters.categories.length > 0) {
      result = result.filter(s => s.category_names?.some(c => filters.categories.includes(c)));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.address?.toLowerCase().includes(term) ||
        s.city?.toLowerCase().includes(term),
      );
    }
    if (filters.city) {
      const cityLower = filters.city.toLowerCase();
      result = result.filter(s => s.city?.toLowerCase() === cityLower);
    }
    // Filter by distance using Haversine (client-side) — avoids Meilisearch pagination cap
    if (filters.maxDistance > 0 && userLocation) {
      result = result.filter(s => {
        if (!s.latitude || !s.longitude) return false;
        const dist = calculateDistance(
          userLocation.lat, userLocation.lon,
          s.latitude, s.longitude,
        );
        return dist <= filters.maxDistance;
      });
    }
    return result;
  }, [allMapServices, filteredServices, filters.categories, filters.city, filters.serviceTypes, filters.maxDistance, searchTerm, userLocation]);

  const totalServiceCount = Math.max(searchResult.total || 0, filteredServices.length);
  const skeletonCardCount = useMemo(() => {
    if (isMobile) {
      return 4;
    }
    return viewMode === "grid" ? 8 : 6;
  }, [isMobile, viewMode]);
  const priorityCardCount = isMobile
    ? DIRECTORY_PRIORITY_CARD_COUNT_MOBILE
    : DIRECTORY_PRIORITY_CARD_COUNT_DESKTOP;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm]);

  // When map view is active, fetch ALL services so every marker is plotted.
  // Strategy: try direct /sbapi/services first, then fall back to paginating
  // through Meilisearch search endpoint (which IS accessible even when the
  // direct API isn't — e.g. in local dev without the backend running).
  useEffect(() => {
    if (!(viewMode === "map" || showFullMap)) return;
    if (allMapServicesFetchedRef.current) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const extractItems = (payload: unknown): unknown[] => {
      if (Array.isArray(payload)) return payload;
      const obj = payload as Record<string, unknown> | null;
      if (Array.isArray(obj?.items)) return obj!.items as unknown[];
      if (Array.isArray(obj?.services)) return obj!.services as unknown[];
      if (Array.isArray(obj?.results)) return obj!.results as unknown[];
      return [];
    };

    (async () => {
      // Mark as in-flight — we'll set to true on success or false on failure/abort
      allMapServicesFetchedRef.current = true;
      let fetchSucceeded = false;
      const allItems: Service[] = [];
      const seenIds = new Set<number | string>();

      const addItems = (rawItems: unknown[]) => {
        for (const raw of rawItems) {
          const r = raw as Record<string, unknown>;
          const id = r.id as number | string;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          allItems.push(transformService(r));
        }
      };

      // ── Approach 1: Direct API /sbapi/services ──────────────────────
      try {
        const resp = await fetch(
          `${SERVICES_API_URL}?limit=5000&skip=0`,
          { signal },
        );
        if (resp.ok) {
          const payload = await resp.json();
          addItems(extractItems(payload));
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        // Direct API failed — will try Meilisearch below
      }

      // If direct API got enough results, we're done
      if (allItems.length >= 200) {
        if (!signal.aborted) {
          fetchSucceeded = true;
          setAllMapServices(allItems);
        }
        return;
      }

      // ── Approach 2: Paginate through Meilisearch search endpoint ────
      // This always works because the search is what powers the grid view.
      allItems.length = 0;
      seenIds.clear();

      const SEARCH_PAGE_SIZE = 200;
      const MAX_PAGES = 20; // safety cap: 200 × 20 = 4000 max
      const SEARCH_ENDPOINTS = [
        '/api/directory/search',
        `${SB_API_BASE}/services/search`,
      ];

      let searchEndpoint = '';
      // Find which search endpoint works
      for (const ep of SEARCH_ENDPOINTS) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        try {
          const testResp = await fetch(
            `${ep}?q=&page=0&per_page=1`,
            { signal },
          );
          if (testResp.ok) {
            const testData = await testResp.json();
            if (testData && typeof testData.total === 'number') {
              searchEndpoint = ep;
              break;
            }
          }
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') throw e;
          // Try next endpoint
        }
      }

      if (!searchEndpoint) {
        // No search endpoint available either — give up
        if (!signal.aborted) {
          allMapServicesFetchedRef.current = false;
        }
        return;
      }

      // Paginate through the search endpoint
      const PARALLEL_BATCH = 4;
      let pageIdx = 0;
      let done = false;

      while (!done && pageIdx < MAX_PAGES) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        // Fetch a batch of pages in parallel
        const batchEnd = Math.min(pageIdx + PARALLEL_BATCH, MAX_PAGES);
        const promises: Promise<unknown[]>[] = [];

        for (let p = pageIdx; p < batchEnd; p++) {
          promises.push(
            (async () => {
              try {
                const resp = await fetch(
                  `${searchEndpoint}?q=&page=${p}&per_page=${SEARCH_PAGE_SIZE}`,
                  { signal },
                );
                if (!resp.ok) return [];
                const data = await resp.json();
                return Array.isArray(data?.hits) ? data.hits : [];
              } catch (e) {
                if ((e as Error)?.name === 'AbortError') throw e;
                return [];
              }
            })(),
          );
        }

        const results = await Promise.all(promises);

        for (const hits of results) {
          if (hits.length === 0) {
            done = true;
            continue;
          }
          if (hits.length < SEARCH_PAGE_SIZE) {
            done = true;
          }
          addItems(hits);
        }

        pageIdx = batchEnd;
      }

      if (!signal.aborted && allItems.length > 0) {
        fetchSucceeded = true;
        setAllMapServices(allItems);
      }
    })().catch((err) => {
      if (err?.name !== 'AbortError') {
        console.error('Failed to fetch all services for map:', err);
      }
    }).finally(() => {
      // Only keep the ref locked if fetch actually succeeded.
      // On abort (StrictMode double-mount, unmount, etc.) or failure, reset
      // so the next effect run will retry.
      if (!fetchSucceeded) {
        allMapServicesFetchedRef.current = false;
      }
    });

    return () => controller.abort();
  }, [viewMode, showFullMap]);

  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);

    // Scroll the results area into view
    requestAnimationFrame(() => {
      const scrollable = Array.from(document.querySelectorAll('*')).find((el) => {
        const s = window.getComputedStyle(el);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
      });
      if (scrollable) (scrollable as HTMLElement).scrollTop = 0;
      window.scrollTo(0, 0);
    });
  }, [totalPages]);

  const toggleFavorite = useCallback(
    async (id: number) => {
      if (id <= 0) return;
      if (!activeUser) {
        if (!sessionResolved) return;
        sessionStorage.setItem("streetbot:postLoginRedirect", "/directory");
        setAuthModalOpen(true);
        return;
      }
      const base = SERVICES_API_URL.replace(/\/$/, "");
      const userId = getOrCreateUserId();
      const isFav = favorites.has(id);
      try {
        const resp = await fetch(
          `${base}/${id}/favorite?user_id=${encodeURIComponent(userId)}`,
          { method: isFav ? "DELETE" : "POST" },
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setFavorites((prev) => {
          const next = new Set(prev);
          if (isFav) next.delete(id);
          else next.add(id);
          return next;
        });
      } catch (error) {
        console.error("Failed to toggle favorite", error);
      }
    },
    [activeUser, favorites, navigate, sessionResolved],
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const clearFilters = () => {
    setCityInput("");
    setFilters({
      search: "",
      categories: [],
      serviceTypes: [],
      agesServed: [],
      gendersServed: [],
      city: "",
      maxDistance: userLocation?.radiusKm ?? 0,
    });
    setSearchTerm("");
  };

  const activeFilterCount =
    filters.categories.length +
    filters.serviceTypes.length +
    filters.agesServed.length +
    filters.gendersServed.length +
    (filters.city ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0 || (userLocation && filters.maxDistance > 0);

  const formatPhone = (phone?: string) => {
    if (!phone) return "";
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  };

  const showMobileSearchHeader = isMobile && mobileSearchOpen;
  const mobileSearchBarHeight = 50;
  const mobileSearchButtonSize = 40;
  const mobileSearchButtonInset = 5;
  const mobileSearchInputPadding = isUltraNarrowMobile ? 8 : isNarrowMobile ? 10 : 12;
  const directorySearchPrimaryBg = dark ? "rgba(63,66,84,0.62)" : "#fff";
  const directorySearchSecondaryBg = dark ? "rgba(124,129,152,0.5)" : "#D9D9D9";
  const directoryLogoSrc = dark ? "/assets/streetvoices-text.svg" : "/assets/streetvoices-text-dark.svg";

  return (
    <div style={{ position: "relative", minHeight: "100%", overflowX: isMobile ? "hidden" : "visible" }}>
      <style>{`.sv-search-input::placeholder { color: #000; opacity: 1; } .sv-mobile-search-input { color: #000 !important; -webkit-text-fill-color: #000 !important; } .sv-mobile-search-input::placeholder { color: #000; opacity: 1; }`}</style>
      {/* GLASSMORPHISM Background Orbs */}
      <div style={gradientOrbs.purple} aria-hidden="true" />
      <div style={gradientOrbs.pink} aria-hidden="true" />
      <div style={gradientOrbs.cyan} aria-hidden="true" />
      <div style={gradientOrbs.gold} aria-hidden="true" />

      {/* Search Nav Bar — matches streetvoices.ca/search */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: isMobile ? 0 : navLeft,
          right: 0,
          zIndex: 20,
          background: viewMode === "map"
            ? (dark ? "rgba(10,10,30,0.82)" : "rgba(255,255,255,0.88)")
            : "transparent",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          padding: showMobileSearchHeader
            ? "0 15px"
            : isMobile
              ? "0 24px"
              : isTablet
                ? "0 16px"
                : "0 24px",
          height: isMobile ? 71 : isTablet ? 62 : 70,
          overflow: isMobile ? "hidden" : "visible",
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
          transition: "left 0.2s ease-out",
        }}
      >
        {!showMobileSearchHeader && (
          <Link
            to="/home"
            style={{
              flexShrink: 0,
              marginRight: isMobile ? 10 : 24,
            }}
          >
            <img
              src={directoryLogoSrc}
              alt="Street Voices"
              width={190}
              height={50}
              loading="eager"
              decoding="async"
              style={{
                height: isMobile ? 50 : isTablet ? 40 : 50,
                maxWidth: isMobile ? 140 : isTablet ? 150 : 190,
              }}
            />
          </Link>
        )}

        {/* Search bar */}
        {isMobile ? (
          mobileSearchOpen ? (
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
                  background: directorySearchPrimaryBg,
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
                    flex: 3.8,
                    minWidth: 0,
                    height: "100%",
                    background: directorySearchPrimaryBg,
                    borderRadius: "30px 0 0 30px",
                    padding: `0 ${mobileSearchInputPadding}px`,
                  }}
                >
                  <input
                    type="text"
                    className="sv-search-input sv-mobile-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={openSuggestions}
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
                    flex: 1.6,
                    minWidth: 0,
                    height: "100%",
                    background: directorySearchSecondaryBg,
                    borderRadius: "0 30px 30px 0",
                    padding: `0 ${mobileSearchInputPadding}px`,
                  }}
                >
                  <input
                    type="text"
                    className="sv-search-input sv-mobile-search-input"
                    value={cityInput}
                    onChange={(e) => {
                      setCityInput(e.target.value);
                      if (!e.target.value) {
                        setFilters((prev) => ({ ...prev, city: "" }));
                      }
                    }}
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
                {/* Search icon button */}
                <button
                  onClick={closeSuggestions}
                  aria-label="Search"
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
              <button
                onClick={() => {
                  setMobileSearchOpen(false);
                  closeSuggestions();
                }}
                aria-label="Close search"
                style={{
                  marginLeft: 14,
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
                <X size={16} />
              </button>
              <ServiceSuggestions suggestions={suggestions} show={showSuggestions} dark={dark} variant="mobile" onSelect={selectSuggestion} onClose={closeSuggestions} />
            </div>
          ) : null
        ) : (
          <div
            ref={suggestionsRef}
            style={{
              display: "flex",
              alignItems: "center",
              flex: "1 1 0%",
              maxWidth: isLargeDesktop ? 540 : 440,
              minWidth: 180,
              marginRight: 24,
              overflow: "visible",
              height: 40,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 3,
                height: "100%",
                background: directorySearchPrimaryBg,
                borderRadius: "30px 0 0 30px",
              }}
            >
              <input
                type="text"
                className="sv-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={openSuggestions}
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
            <ServiceSuggestions suggestions={suggestions} show={showSuggestions} dark={dark} variant="desktop" onSelect={selectSuggestion} onClose={closeSuggestions} />
            <div
              ref={cityDropdownRef}
              style={{
                display: "flex",
                alignItems: "center",
                flex: 2,
                height: "100%",
                background: directorySearchSecondaryBg,
                borderRadius: "0 30px 30px 0",
                paddingRight: 60,
                marginRight: -60,
                position: "relative",
              }}
            >
              <input
                type="text"
                className="sv-search-input"
                value={cityInput}
                onChange={(e) => {
                  setCityInput(e.target.value);
                  setShowCityDropdown(true);
                  // Clear the confirmed filter when user edits text (so partial text doesn't filter results)
                  if (!e.target.value) {
                    setFilters((prev) => ({ ...prev, city: "" }));
                  }
                }}
                onFocus={() => setShowCityDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredCityFacets.length > 0) {
                    selectCity(filteredCityFacets[0][0]);
                  }
                }}
                onBlur={() => {
                  // On blur, revert input text to the confirmed filter if user didn't select
                  setTimeout(() => {
                    if (cityInput !== filters.city) {
                      setCityInput(filters.city);
                    }
                    setShowCityDropdown(false);
                  }, 200); // Delay to allow dropdown click to register
                }}
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
              {/* City autocomplete dropdown */}
              {showCityDropdown && filteredCityFacets.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: -1,
                    right: -1,
                    marginTop: 4,
                    background: dark ? "rgba(24,24,32,0.97)" : "rgba(255,255,255,0.97)",
                    backdropFilter: "blur(20px) saturate(140%)",
                    WebkitBackdropFilter: "blur(20px) saturate(140%)",
                    border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                    borderRadius: 16,
                    boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.15)",
                    zIndex: 200,
                    overflow: "hidden",
                    maxHeight: 320,
                    overflowY: "auto" as const,
                  }}
                >
                  {filteredCityFacets.map(([name, count]) => (
                    <div
                      key={name}
                      onClick={() => selectCity(name)}
                      style={{
                        padding: "9px 14px",
                        cursor: "pointer",
                        fontSize: 13,
                        color: dark ? "#fff" : "#1a1c24",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <MapPin size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                        {name}
                      </span>
                      <span style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.35)" : "#aaa" }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Search button — yellow pill with text */}
            <button
              onClick={() => {/* search is already reactive via filters */}}
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
        )}

        {/* Nav links + Donate — right (desktop only) */}
        {isLargeDesktop ? (
          <nav style={{ display: "flex", alignItems: "center", gap: 24, marginLeft: "auto", whiteSpace: "nowrap" }}>
            <Link to="/directory" style={{ color: navTextColor, fontSize: isLargeDesktop ? 16 : 14, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>Directory</Link>
            <a href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw" target="_blank" rel="noopener noreferrer" style={{ color: navTextColor, fontSize: isLargeDesktop ? 16 : 14, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>Programs</a>
            <Link to="/news" style={{ color: navTextColor, fontSize: isLargeDesktop ? 16 : 14, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>News</Link>
            <Link to="/about" style={{ color: navTextColor, fontSize: isLargeDesktop ? 16 : 14, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>About Us</Link>
            {!activeUser && sessionResolved && (
              <button
                onClick={() => setAuthModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: isLargeDesktop ? 43 : 36,
                  padding: isLargeDesktop ? "0 28px" : "0 18px",
                  borderRadius: 50,
                  border: "2px solid #FFD600",
                  background: "transparent",
                  color: navTextColor,
                  fontSize: isLargeDesktop ? 16 : 14,
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
                height: isLargeDesktop ? 43 : 36,
                padding: isLargeDesktop ? "0 28px" : "0 18px",
                borderRadius: 50,
                border: "none",
                background: "#FFD600",
                color: "#000",
                fontSize: isLargeDesktop ? 16 : 14,
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
              onClick={() => setTheme(dark ? "light" : "dark")}
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
            {activeUser && (
              <Link
                to="/settings"
                aria-label="Profile"
                style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
              >
                {activeUser.avatar ? (
                  <img
                    src={activeUser.avatar}
                    alt={activeUser.name || "Profile"}
                    style={{ width: isLargeDesktop ? 32 : 28, height: isLargeDesktop ? 32 : 28, borderRadius: "50%", objectFit: "cover" }}
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
                    {activeUser?.name?.charAt(0)?.toUpperCase() || activeUser?.username?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </Link>
            )}
          </nav>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexShrink: 0 }}>
            {/* Theme toggle (visible at 1024-1279 and mobile/tablet) */}
            {isDesktop && !isLargeDesktop && (
              <button
                onClick={() => setTheme(dark ? "light" : "dark")}
                aria-label="Toggle theme"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: navTextColor,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: 4,
                }}
              >
                {dark ? (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                ) : (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
              </button>
            )}
            {isMobile && !mobileSearchOpen && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
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
                <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={dark} />
                <MobileMenuDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
              <Link to="/directory" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileMenuOpen(false)}>Directory</Link>
              <a href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw" target="_blank" rel="noopener noreferrer" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileMenuOpen(false)}>Programs</a>
              <Link to="/news" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileMenuOpen(false)}>News</Link>
              <Link to="/about" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileMenuOpen(false)}>About Us</Link>
              <div style={getMobileDividerStyle(dark)} />
              {!activeUser && sessionResolved && (
                <button
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 16px",
                    color: dark ? "#E6E7F2" : "#1a1c24",
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: "Rubik, sans-serif",
                    textAlign: "center",
                    borderRadius: 8,
                    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                  onClick={() => { setMobileMenuOpen(false); setAuthModalOpen(true); }}
                >
                  Login
                </button>
              )}
              <a
                href="/donate"
                style={{
                  display: "block",
                  padding: "12px 16px",
                  color: "#000",
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: "Rubik, sans-serif",
                  textDecoration: "none",
                  textAlign: "center",
                  borderRadius: 8,
                  background: "#FFD600",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Donate
              </a>
              <div style={getMobileDividerStyle(dark)} />
              <button
                onClick={toggleTheme}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  color: dark ? "#E6E7F2" : "#1a1c24",
                  fontSize: 16,
                  fontWeight: 500,
                  fontFamily: "Rubik, sans-serif",
                  cursor: "pointer",
                }}
              >
                {dark ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                {dark ? "Light Mode" : "Dark Mode"}
              </button>
                </MobileMenuDrawer>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ margin: "0 auto", padding: isMobile ? "16px 12px" : isTablet ? "16px 18px" : "16px 24px", paddingTop: isMobile ? 87 : isTablet ? 78 : 86, position: "relative", zIndex: 1 }}>
        {/* Header Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            marginBottom: isMobile ? "16px" : "24px",
            flexWrap: "wrap",
            gap: isMobile ? "10px" : "16px",
          }}
        >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isUltraNarrowMobile ? "flex-start" : isMobile ? "space-between" : "flex-start",
                width: isMobile ? "100%" : undefined,
                gap: isMobile ? "8px" : "16px",
                flexDirection: isUltraNarrowMobile ? "column" : "row",
              }}
            >
            <p style={{ fontSize: "1rem", color: colors.textSecondary, margin: 0 }}>
              <span
                style={{
                  fontWeight: 600,
                  color: colors.text,
                  display: "inline-block",
                  minWidth: "4ch",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {isResultsLoading ? "..." : searchResult.total || filteredServices.length}
              </span>{" "}
              services found
              <span
                style={{
                  fontSize: "12px",
                  color: colors.textMuted,
                  marginLeft: 8,
                  display: "inline-block",
                  minWidth: "56px",
                  fontVariantNumeric: "tabular-nums",
                  visibility: searchResult.processingTimeMs > 0 ? "visible" : "hidden",
                }}
              >
                ({searchResult.processingTimeMs || 0}ms)
              </span>
            </p>

            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: isMobile ? "8px 12px" : "8px 16px",
                borderRadius: "14px",
                fontSize: "14px",
                fontWeight: 500,
                background: colors.surface,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: `1px solid ${colors.border}`,
                boxShadow: colors.glassShadow,
                color: colors.text,
                cursor: "pointer",
                width: isUltraNarrowMobile ? "100%" : undefined,
                justifyContent: isUltraNarrowMobile ? "center" : "flex-start",
              }}
            >
              <Filter size={16} />
              {isFilterOpen ? "Hide Filters" : "Show Filters"}
              {hasActiveFilters && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "20px",
                    width: "20px",
                    borderRadius: "50%",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: colors.accent,
                    color: "#000",
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* View Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isMobile ? "space-between" : "flex-start",
              flexWrap: isNarrowMobile ? "wrap" : "nowrap",
              width: isMobile ? "100%" : undefined,
              gap: isMobile ? "8px" : "12px",
            }}
          >
            <button
              onClick={() => {
                setShowFullMap(false);
                setViewMode("map");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: isMobile ? "5px" : "8px",
                padding: isMobile ? "6px 10px" : "8px 16px",
                borderRadius: "14px",
                fontSize: isMobile ? "13px" : "14px",
                fontWeight: 500,
                flex: isUltraNarrowMobile ? "1 1 100%" : isNarrowMobile ? "1 1 calc(50% - 4px)" : undefined,
                justifyContent: isMobile ? "center" : "flex-start",
                minWidth: 0,
                background: colors.surface,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: `1px solid ${colors.border}`,
                boxShadow: colors.glassShadow,
                color: colors.text,
                cursor: "pointer",
              }}
            >
              <MapIcon size={isMobile ? 14 : 16} />
              Maps
            </button>

            {/* Near Me geo button */}
            <button
              onClick={() => {
                if (nearMeActive) {
                  setNearMeActive(false);
                } else if (userLocation) {
                  setNearMeActive(true);
                } else {
                  handleGetCurrentLocation();
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: isMobile ? "5px" : "8px",
                padding: isMobile ? "6px 10px" : "8px 16px",
                borderRadius: "14px",
                fontSize: isMobile ? "13px" : "14px",
                fontWeight: 500,
                flex: isUltraNarrowMobile ? "1 1 100%" : isNarrowMobile ? "1 1 calc(50% - 4px)" : undefined,
                justifyContent: isMobile ? "center" : "flex-start",
                minWidth: 0,
                background: nearMeActive ? "rgba(34, 197, 94, 0.15)" : colors.surface,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: `1px solid ${nearMeActive ? "#22c55e" : colors.border}`,
                boxShadow: colors.glassShadow,
                color: nearMeActive ? "#22c55e" : colors.text,
                cursor: "pointer",
              }}
            >
              <Locate size={isMobile ? 14 : 16} />
              {isNarrowMobile ? (isLocating ? "..." : "") : (isLocating ? "Locating..." : "Near Me")}
            </button>

            {/* Grid/List/Map Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: colors.surface,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                padding: "5px",
                borderRadius: "16px",
                border: `1px solid ${colors.border}`,
                boxShadow: colors.glassShadow,
                flexShrink: 0,
                flex: isNarrowMobile ? "1 1 100%" : undefined,
                width: isNarrowMobile ? "100%" : undefined,
              }}
            >
              {(
                [
                  { mode: "grid" as const, icon: Grid3X3, title: "Grid View" },
                  { mode: "list" as const, icon: LayoutList, title: "List View" },
                ] as const
              ).map(({ mode, icon: Icon, title }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={title}
                  style={{
                    height: isNarrowMobile ? "30px" : isMobile ? "30px" : "32px",
                    width: isNarrowMobile ? "auto" : isMobile ? "36px" : "40px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    cursor: "pointer",
                    background: viewMode === mode ? colors.accent : "transparent",
                    color: viewMode === mode ? "#000" : colors.textSecondary,
                    flex: isNarrowMobile ? 1 : undefined,
                  }}
                >
                  <Icon size={isMobile ? 14 : 16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div style={{ display: "flex", gap: isMobile ? "0" : isTablet ? "16px" : "24px" }}>
          {/* Filter Sidebar (hidden when full-screen map is open — map has its own filter panel) */}
          {isFilterOpen && !showFullMap && (
            <aside
              style={isMobile ? {
                position: "fixed",
                top: 71,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 50,
                background: dark ? "rgba(20, 21, 29, 0.98)" : "rgba(247, 248, 252, 0.98)",
                overflowY: "auto",
                padding: "16px",
              } : {
                width: isTablet ? "220px" : "260px",
                flexShrink: 0,
                background: colors.surface,
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                borderRadius: "24px",
                border: `1px solid ${colors.border}`,
                boxShadow: colors.glassShadow,
                height: "fit-content",
                position: "sticky",
                top: "24px",
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: `1px solid ${colors.border}`,
                  position: isMobile ? "sticky" : "static",
                  top: isMobile ? 0 : undefined,
                  zIndex: isMobile ? 2 : undefined,
                  margin: isMobile ? "-16px -16px 0" : undefined,
                  background: isMobile
                    ? (dark ? "rgba(20, 21, 29, 0.98)" : "rgba(247, 248, 252, 0.98)")
                    : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: colors.text,
                      margin: 0,
                    }}
                  >
                    Filters
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: "13px",
                          color: colors.accentText,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Clear all
                      </button>
                    )}
                    {isMobile && (
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        aria-label="Close filters"
                        style={{
                          background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                          border: `1px solid ${colors.border}`,
                          padding: "6px 10px",
                          borderRadius: 999,
                          cursor: "pointer",
                          color: colors.text,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <X size={20} />
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: "16px 20px" }}>
                {/* Categories */}
                <div style={{ marginBottom: "16px" }}>
                  <button
                    onClick={() => toggleSection("categories")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
                      Category
                    </span>
                    <ChevronDown
                      size={16}
                      color={colors.textSecondary}
                      style={{
                        transform: expandedSections.has("categories")
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>
                  {expandedSections.has("categories") && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {dynamicCategoryOptions.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <label
                            key={cat.value}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              cursor: "pointer",
                              padding: "8px 10px",
                              borderRadius: "8px",
                              background: filters.categories.includes(cat.value)
                                ? "rgba(255, 214, 0, 0.1)"
                                : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={filters.categories.includes(cat.value)}
                              onChange={() => toggleCategory(cat.value)}
                              style={{
                                accentColor: colors.accent,
                                width: 16,
                                height: 16,
                                cursor: "pointer",
                              }}
                            />
                            <Icon size={16} color={colors.textSecondary} />
                            <span style={{ fontSize: "14px", color: colors.text, flex: 1 }}>
                              {cat.label}
                            </span>
                            {categoryFacets[cat.value] !== undefined && (
                              <span style={{ fontSize: "12px", color: colors.textMuted, fontWeight: 500 }}>
                                {categoryFacets[cat.value]}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Service Type (dynamic from facets) */}
                {(() => {
                  const typeFacets = searchResult.facets?.service_type || {};
                  const typeEntries = Object.entries(typeFacets)
                    .filter(([name]) => name.length > 0)
                    .sort((a, b) => b[1] - a[1]);
                  if (typeEntries.length === 0) return null;
                  return (
                    <div style={{ marginBottom: "16px" }}>
                      <button
                        onClick={() => toggleSection("serviceTypes")}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                          padding: "8px 0",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
                          Type
                        </span>
                        <ChevronDown
                          size={16}
                          color={colors.textSecondary}
                          style={{
                            transform: expandedSections.has("serviceTypes")
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </button>
                      {expandedSections.has("serviceTypes") && (
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            maxHeight: "240px",
                            overflowY: "auto",
                          }}
                        >
                          {typeEntries.map(([name, count]) => (
                            <label
                              key={name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                background: filters.serviceTypes.includes(name)
                                  ? "rgba(255, 214, 0, 0.1)"
                                  : "transparent",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={filters.serviceTypes.includes(name)}
                                onChange={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    serviceTypes: prev.serviceTypes.includes(name)
                                      ? prev.serviceTypes.filter((t) => t !== name)
                                      : [...prev.serviceTypes, name],
                                  }));
                                }}
                                style={{
                                  accentColor: colors.accent,
                                  width: 16,
                                  height: 16,
                                  cursor: "pointer",
                                }}
                              />
                              <span style={{ fontSize: "13px", color: colors.text, flex: 1 }}>
                                {name}
                              </span>
                              <span style={{ fontSize: "12px", color: colors.textMuted, fontWeight: 500 }}>
                                {count}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Ages Served (dynamic from facets) */}
                {(() => {
                  const ageFacets = searchResult.facets?.ages_served || {};
                  const ageEntries = Object.entries(ageFacets)
                    .filter(([name]) => name.length > 0)
                    .sort((a, b) => b[1] - a[1]);
                  if (ageEntries.length === 0) return null;
                  return (
                    <div style={{ marginBottom: "16px" }}>
                      <button
                        onClick={() => toggleSection("agesServed")}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                          padding: "8px 0",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
                          Ages Served
                        </span>
                        <ChevronDown
                          size={16}
                          color={colors.textSecondary}
                          style={{
                            transform: expandedSections.has("agesServed")
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </button>
                      {expandedSections.has("agesServed") && (
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            maxHeight: "200px",
                            overflowY: "auto",
                          }}
                        >
                          {ageEntries.map(([name, count]) => (
                            <label
                              key={name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                background: filters.agesServed.includes(name)
                                  ? "rgba(255, 214, 0, 0.1)"
                                  : "transparent",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={filters.agesServed.includes(name)}
                                onChange={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    agesServed: prev.agesServed.includes(name)
                                      ? prev.agesServed.filter((a) => a !== name)
                                      : [...prev.agesServed, name],
                                  }));
                                }}
                                style={{
                                  accentColor: colors.accent,
                                  width: 16,
                                  height: 16,
                                  cursor: "pointer",
                                }}
                              />
                              <span style={{ fontSize: "13px", color: colors.text, flex: 1 }}>
                                {name}
                              </span>
                              <span style={{ fontSize: "12px", color: colors.textMuted, fontWeight: 500 }}>
                                {count}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Genders Served (dynamic from facets) */}
                {(() => {
                  const genderFacets = searchResult.facets?.gender_served || {};
                  const genderEntries = Object.entries(genderFacets)
                    .filter(([name]) => name.length > 0)
                    .sort((a, b) => b[1] - a[1]);
                  if (genderEntries.length === 0) return null;
                  return (
                    <div style={{ marginBottom: "16px" }}>
                      <button
                        onClick={() => toggleSection("gendersServed")}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                          padding: "8px 0",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
                          Genders Served
                        </span>
                        <ChevronDown
                          size={16}
                          color={colors.textSecondary}
                          style={{
                            transform: expandedSections.has("gendersServed")
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </button>
                      {expandedSections.has("gendersServed") && (
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            maxHeight: "200px",
                            overflowY: "auto",
                          }}
                        >
                          {genderEntries.map(([name, count]) => (
                            <label
                              key={name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                background: filters.gendersServed.includes(name)
                                  ? "rgba(255, 214, 0, 0.1)"
                                  : "transparent",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={filters.gendersServed.includes(name)}
                                onChange={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    gendersServed: prev.gendersServed.includes(name)
                                      ? prev.gendersServed.filter((g) => g !== name)
                                      : [...prev.gendersServed, name],
                                  }));
                                }}
                                style={{
                                  accentColor: colors.accent,
                                  width: 16,
                                  height: 16,
                                  cursor: "pointer",
                                }}
                              />
                              <span style={{ fontSize: "13px", color: colors.text, flex: 1 }}>
                                {name}
                              </span>
                              <span style={{ fontSize: "12px", color: colors.textMuted, fontWeight: 500 }}>
                                {count}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Distance Filter */}
                <div>
                  <button
                    onClick={() => toggleSection("distance")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
                      Distance
                    </span>
                    <ChevronDown
                      size={16}
                      color={colors.textSecondary}
                      style={{
                        transform: expandedSections.has("distance")
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>
                  {expandedSections.has("distance") && (
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {/* Current Location Display */}
                      <div
                        style={{
                          padding: "10px 12px",
                          background: userLocation
                            ? "rgba(34, 197, 94, 0.1)"
                            : "rgba(255, 214, 0, 0.1)",
                          borderRadius: "8px",
                          border: `1px solid ${userLocation ? "rgba(34, 197, 94, 0.3)" : colors.border}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "6px",
                          }}
                        >
                          <Locate
                            size={14}
                            color={userLocation ? "#22c55e" : colors.accent}
                          />
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color: colors.text,
                            }}
                          >
                            {userLocation ? "Your Location" : "Location Not Set"}
                          </span>
                        </div>
                        {userLocation ? (
                          <p
                            style={{
                              fontSize: "12px",
                              color: colors.textSecondary,
                              margin: 0,
                            }}
                          >
                            {userLocation.label}
                          </p>
                        ) : (
                          <p
                            style={{
                              fontSize: "11px",
                              color: colors.textMuted,
                              margin: 0,
                            }}
                          >
                            Set location in Settings or use button below
                          </p>
                        )}
                      </div>

                      {/* Get Current Location Button */}
                      <button
                        onClick={handleGetCurrentLocation}
                        disabled={isLocating}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          width: "100%",
                          padding: "10px 16px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          background: colors.accent,
                          color: "#000",
                          border: "none",
                          cursor: isLocating ? "not-allowed" : "pointer",
                          opacity: isLocating ? 0.7 : 1,
                        }}
                      >
                        <Navigation
                          size={14}
                          style={{
                            transform: isLocating ? "rotate(360deg)" : "none",
                            transition: "transform 1s",
                          }}
                        />
                        {isLocating ? "Getting Location..." : "Use My Location"}
                      </button>

                      {/* Distance Options */}
                      {userLocation && (
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          {DISTANCE_OPTIONS.map((option) => (
                            <label
                              key={option.value}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                background:
                                  filters.maxDistance === option.value
                                    ? "rgba(255, 214, 0, 0.1)"
                                    : "transparent",
                              }}
                            >
                              <input
                                type="radio"
                                name="distance"
                                checked={filters.maxDistance === option.value}
                                onChange={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    maxDistance: option.value,
                                  }));
                                }}
                                style={{
                                  accentColor: colors.accent,
                                  width: 16,
                                  height: 16,
                                }}
                              />
                              <span style={{ fontSize: "14px", color: colors.text }}>
                                {option.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* Services Grid/List/Map */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isResultsLoading ? (
              /* Skeleton loading state */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                  gap: isMobile ? "16px" : isTablet ? "18px" : "24px",
                }}
              >
                {Array.from({ length: skeletonCardCount }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      minHeight: isMobile ? "560px" : "450px",
                      borderRadius: "24px",
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "180px",
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: "24px 24px 0 0",
                      }}
                    />
                    <div style={{ padding: "20px" }}>
                      <div
                        style={{
                          height: "24px",
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: "6px",
                          width: "75%",
                          margin: "0 auto 12px",
                        }}
                      />
                      <div
                        style={{
                          height: "16px",
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: "6px",
                          width: "100%",
                          marginBottom: "8px",
                        }}
                      />
                      <div
                        style={{
                          height: "16px",
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: "6px",
                          width: "83%",
                          marginBottom: "16px",
                        }}
                      />
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <div
                          style={{
                            height: "24px",
                            width: "64px",
                            background: "rgba(255,255,255,0.1)",
                            borderRadius: "9999px",
                          }}
                        />
                        <div
                          style={{
                            height: "24px",
                            width: "64px",
                            background: "rgba(255,255,255,0.1)",
                            borderRadius: "9999px",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredServices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <Building2
                  size={48}
                  color={colors.textMuted}
                  style={{ marginBottom: "16px" }}
                />
                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: colors.text,
                    marginBottom: "8px",
                  }}
                >
                  No services found
                </h3>
                <p style={{ color: colors.textSecondary }}>Try adjusting your filters</p>
              </div>
            ) : viewMode === "map" ? (
              /* Map View — Interactive Leaflet */
              <div
                style={{
                  position: "relative",
                  background: colors.surface,
                  borderRadius: "16px",
                  border: `1px solid ${colors.border}`,
                  overflow: "hidden",
                }}
              >
                <Suspense
                  fallback={
                    <div
                      style={{
                        height: 420,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: colors.textSecondary,
                      }}
                    >
                      Loading map...
                    </div>
                  }
                >
                  <DirectoryMap
                    services={mapServices}
                    colors={colors}
                    userLocation={userLocation}
                    selectedServiceId={selectedService}
                    dark={dark}
                    style={showMapList ? undefined : { minHeight: 600 }}
                  />
                </Suspense>
                {/* Floating filter button on map */}
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  style={{
                    position: "absolute",
                    bottom: 16,
                    right: 16,
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 18px",
                    borderRadius: "30px",
                    border: "none",
                    background: colors.accent || "#FFD600",
                    color: "#000",
                    fontSize: "13px",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.05)"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
                >
                  <Filter size={15} />
                  Filters
                  {(filters.categories.length > 0 || filters.city || searchTerm) && (
                    <span style={{
                      background: "#000",
                      color: colors.accent || "#FFD600",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 800,
                    }}>
                      {filters.categories.length + (filters.city ? 1 : 0) + (searchTerm ? 1 : 0)}
                    </span>
                  )}
                </button>
                {/* Map marker count badge */}
                <div style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  zIndex: 10,
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: dark ? "rgba(30,31,40,0.88)" : "rgba(255,255,255,0.92)",
                  color: colors.text,
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                  border: `1px solid ${colors.border}`,
                }}>
                  {mapServices.length} services
                </div>
                {/* Toggle bar for service list */}
                <button
                  onClick={() => setShowMapList(!showMapList)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 0",
                    border: "none",
                    borderTop: `1px solid ${colors.border}`,
                    background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                    color: colors.textSecondary,
                    fontSize: "12px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"; }}
                >
                  {showMapList ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  {showMapList ? "Hide list" : `Show list (${mapServices.length})`}
                </button>
                {/* Collapsible service list below map */}
                {showMapList && (
                  <div style={{ maxHeight: "300px", overflowY: "auto", padding: "12px" }}>
                    {mapServices.map(service => (
                      <div
                        key={service.id}
                        onClick={() => setSelectedService(selectedService === service.id ? null : service.id)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          marginBottom: "6px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          background: selectedService === service.id ? (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)") : "transparent",
                          transition: "background 0.15s",
                        }}
                      >
                        <MapPin size={14} color={colors.accent} />
                        <span style={{ fontSize: "14px", fontWeight: 500, color: colors.text }}>{service.name}</span>
                        <span style={{ fontSize: "12px", color: colors.textMuted, marginLeft: "auto" }}>
                          {service.distance ? `${service.distance.toFixed(1)} km` : service.address || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                    gap: isMobile ? "16px" : isTablet ? "18px" : "24px",
                  }}
                >
                  {visibleServices.map((service, index) => {
                    const CategoryIcon = getCategoryIcon(
                      service.category_names?.[0] || "",
                    );
                    return (
                      <div
                        key={service.id}
                        onMouseEnter={() => prefetchServiceDetail(service.id)}
                        style={
                          index >= priorityCardCount
                            ? {
                                width: "100%",
                                minWidth: 0,
                                contentVisibility: "auto",
                                containIntrinsicSize: isMobile ? undefined : "560px",
                              }
                            : {
                                width: "100%",
                                minWidth: 0,
                              }
                        }
                      >
                        <ServiceCard
                          service={service}
                          onToggleFavorite={toggleFavorite}
                          onShare={shareService}
                          onGetHelp={isDirectory ? undefined : (svc) => {
                            const context = encodeURIComponent(
                              `I need help contacting ${svc.name}${svc.city ? ` in ${svc.city}` : ""}. Can you help me reach out to them or find their contact information?`,
                            );
                            navigate(`/chat?context=${context}`);
                          }}
                          onPreview={(id) => setPreviewServiceId(id)}
                          isFavorite={favorites.has(service.id)}
                          priorityMedia={index < priorityCardCount}
                          compactMobile={isUltraNarrowMobile}
                          isMobileCard={isMobile}
                          colors={colors}
                          CategoryIcon={CategoryIcon}
                          formatPhone={formatPhone}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} colors={colors} />
                )}
              </>
            ) : (
              /* List View */
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {visibleServices.map((service, index) => {
                    const CategoryIcon = getCategoryIcon(
                      service.category_names?.[0] || "",
                    );
                    return (
                      <div
                        key={service.id}
                        onClick={() =>
                          navigate(
                            service.id <= 0
                              ? `/directory/${service.id}?sampleName=${encodeURIComponent(service.name)}`
                              : `/directory/${service.id}`,
                          )
                        }
                        onMouseEnter={() => prefetchServiceDetail(service.id)}
                        style={{
                          contentVisibility: index >= priorityCardCount ? "auto" : "visible",
                          containIntrinsicSize:
                            index >= priorityCardCount && !isMobile ? "240px" : undefined,
                          display: "flex",
                          flexDirection: isMobile ? "column" : "row",
                          gap: isMobile ? "12px" : "20px",
                          padding: isMobile ? "12px" : "20px",
                          borderRadius: isMobile ? "20px" : "24px",
                          cursor: "pointer",
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          boxSizing: "border-box",
                          background: colors.cardBg,
                          border: `1px solid ${colors.border}`,
                          boxShadow: colors.glassShadow,
                          backdropFilter: "blur(20px) saturate(180%)",
                          WebkitBackdropFilter: "blur(20px) saturate(180%)",
                          transition:
                            "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
                        }}
                      >
                        {/* Large Logo */}
                        <div
                          style={{
                            width: isMobile ? "100%" : 140,
                            height: isMobile ? 160 : 140,
                            borderRadius: isMobile ? "14px" : "16px",
                            overflow: "hidden",
                            background: "#fff",
                            border: `1px solid ${colors.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            loading={index < priorityCardCount ? "eager" : "lazy"}
                            decoding="async"
                            width={180}
                            height={120}
                            src={service.logo || "/service-logos/default.svg"}
                            alt={service.name}
                            style={{
                              maxWidth: isMobile ? "80%" : "90%",
                              maxHeight: isMobile ? "130px" : "120px",
                              width: "auto",
                              height: "auto",
                              objectFit: "contain",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "/service-logos/default.svg";
                            }}
                          />
                        </div>

                        {/* Main Content */}
                        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
                          {/* Header Row */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: isMobile ? "stretch" : "flex-start",
                              justifyContent: "space-between",
                              flexDirection: isMobile ? "column" : "row",
                              gap: isMobile ? "10px" : "0",
                              marginBottom: "8px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  marginBottom: "4px",
                                }}
                              >
                                <h3
                                  style={{
                                    fontSize: isMobile ? "1.02rem" : "1.1rem",
                                    lineHeight: 1.25,
                                    fontWeight: 700,
                                    color: colors.text,
                                    margin: 0,
                                  }}
                                >
                                  {service.name}
                                </h3>
                                {service.is_verified && (
                                  <BadgeCheck size={18} color="#3b82f6" />
                                )}
                              </div>
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 10px",
                                  borderRadius: "14px",
                                  background: colors.accent,
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: "#000",
                                }}
                              >
                                <CategoryIcon size={12} color="#000" />
                                {service.category_names?.[0] || "Service"}
                              </div>
                            </div>

                            {/* Actions */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexShrink: 0,
                                width: isMobile ? "100%" : "auto",
                                justifyContent: isMobile ? "flex-end" : "flex-start",
                              }}
                            >
                              {service.rating && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    marginRight: isMobile ? "auto" : "8px",
                                  }}
                                >
                                  <Star
                                    size={16}
                                    color={colors.accent}
                                    fill={colors.accent}
                                  />
                                  <span
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: 600,
                                      color: colors.text,
                                    }}
                                  >
                                    {service.rating.toFixed(1)}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: colors.textMuted,
                                    }}
                                  >
                                    ({service.rating_count})
                                  </span>
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (service.id <= 0) return;
                                  toggleFavorite(service.id);
                                }}
                                aria-label="Save to favorites"
                                style={{
                                  height: isMobile ? "36px" : "40px",
                                  width: isMobile ? "36px" : "40px",
                                  borderRadius: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: `1px solid ${colors.border}`,
                                  background: "transparent",
                                  cursor: "pointer",
                                }}
                              >
                                <Heart
                                  size={20}
                                  color={
                                    favorites.has(service.id) ? "#ef4444" : colors.textMuted
                                  }
                                  fill={
                                    favorites.has(service.id) ? "#ef4444" : "none"
                                  }
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (service.id <= 0) return;
                                  shareService(service.id, service.name);
                                }}
                                aria-label="Share service"
                                style={{
                                  height: isMobile ? "36px" : "40px",
                                  width: isMobile ? "36px" : "40px",
                                  borderRadius: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: `1px solid ${colors.border}`,
                                  background: "transparent",
                                  cursor: "pointer",
                                }}
                              >
                                <Share2 size={20} color={colors.textMuted} />
                              </button>
                            </div>
                          </div>

                          {/* Description */}
                          <p
                            style={{
                              fontSize: "14px",
                              color: colors.textSecondary,
                              lineHeight: 1.5,
                              margin: "0 0 10px 0",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {/* Prefer _formatted (cropped+highlighted) over raw fields */}
                            {(() => {
                              const fmt = service._formatted;
                              const formattedText = fmt?.overview || fmt?.description;
                              if (formattedText) {
                                return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
                              }
                              return service.description || "Community service provider";
                            })()}
                          </p>

                          {/* Tags */}
                          {service.tags && service.tags.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                                marginBottom: "12px",
                              }}
                            >
                              {service.tags.slice(0, 5).map((tag, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "9999px",
                                    fontSize: "11px",
                                    fontWeight: 500,
                                    background: "rgba(255, 214, 0, 0.15)",
                                    color: colors.accent,
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                              {service.tags.length > 5 && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "9999px",
                                    fontSize: "11px",
                                    background: "rgba(255,255,255,0.1)",
                                    color: colors.textMuted,
                                  }}
                                >
                                  +{service.tags.length - 5}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Contact Info Row */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: isMobile ? "column" : "row",
                              flexWrap: isMobile ? "nowrap" : "wrap",
                              gap: isMobile ? "10px" : "16px",
                              alignItems: isMobile ? "stretch" : "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "6px",
                                width: isMobile ? "100%" : "auto",
                              }}
                            >
                              <MapPin size={14} color={colors.accent} />
                              <span style={{ fontSize: "13px", color: colors.text, lineHeight: 1.45 }}>
                                {service.address ||
                                  service.city ||
                                  "Location not available"}
                              </span>
                            </div>
                            {service.phone && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  width: isMobile ? "100%" : "auto",
                                }}
                              >
                                <Phone size={14} color={colors.accent} />
                                <a
                                  href={`tel:${service.phone!.replace(/\D/g, "")}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    fontSize: "13px",
                                    color: colors.accentText,
                                    textDecoration: "none",
                                    fontWeight: 500,
                                  }}
                                >
                                  {formatPhone(service.phone)}
                                </a>
                              </div>
                            )}
                            {service.distance !== undefined && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  width: isMobile ? "100%" : "auto",
                                }}
                              >
                                <Navigation size={14} color="#22c55e" />
                                <span
                                  style={{
                                    fontSize: "13px",
                                    color: "#22c55e",
                                    fontWeight: 600,
                                  }}
                                >
                                  {formatDistance(service.distance)} away
                                </span>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewServiceId(service.id);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                padding: isMobile ? "10px 14px" : "8px 14px",
                                borderRadius: "10px",
                                fontSize: "13px",
                                fontWeight: 600,
                                width: isMobile ? "100%" : "auto",
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "#3b82f6",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              <Eye size={14} />
                              Preview
                            </button>
                            {!isDirectory && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const context = encodeURIComponent(
                                  `I need help contacting ${service.name}${service.city ? ` in ${service.city}` : ""}. Can you help me reach out to them or find their contact information?`,
                                );
                                navigate(`/chat?context=${context}`);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                padding: isMobile ? "10px 14px" : "8px 14px",
                                borderRadius: "10px",
                                fontSize: "13px",
                                fontWeight: 600,
                                marginLeft: isMobile ? 0 : "auto",
                                alignSelf: isMobile ? "stretch" : "auto",
                                width: isMobile ? "100%" : "auto",
                                background: "rgba(255, 214, 0, 0.15)",
                                color: colors.accent,
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              <MessageCircle size={14} />
                              Get Help
                            </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Pagination for List View */}
                {totalPages > 1 && (
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} colors={colors} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen Map Modal */}
      {showFullMap && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: dark ? "rgba(0, 0, 0, 0.92)" : "rgba(240, 241, 247, 0.98)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Nav bar inside modal (position: fixed, so needs spacer below) */}
          <DirectoryNavBar
            searchTerm={searchTerm}
            onSearchChange={(val) => setSearchTerm(val)}
            cityFilter={cityInput}
            onCityChange={(val) => {
              setCityInput(val);
              if (!val) {
                setFilters((prev) => ({ ...prev, city: "" }));
              }
            }}
            isMobile={isMobile || isTablet}
            mapMode
          />
          {/* Spacer for fixed nav bar */}
          <div style={{ height: isMobile ? 71 : 70, flexShrink: 0 }} />
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "10px 16px" : "12px 24px",
            borderBottom: `1px solid ${colors.border}`,
            background: dark ? "rgba(10,10,30,0.9)" : "rgba(255,255,255,0.95)",
          }}>
            <h3 style={{ margin: 0, fontSize: isMobile ? "15px" : "18px", fontWeight: 700, color: colors.text }}>
              Service Map ({mapServices.length} locations)
            </h3>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: isFilterOpen
                    ? (dark ? "rgba(255,214,0,0.2)" : "rgba(255,214,0,0.25)")
                    : (dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"),
                  color: colors.text,
                  border: `1px solid ${isFilterOpen ? (colors.accent || "#FFD600") : colors.border}`,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span style={{
                    background: colors.accent || "#FFD600",
                    color: "#000",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: 800,
                  }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setIsFilterOpen(false); setShowFullMap(false); }}
                style={{
                  padding: "8px 20px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Close
              </button>
            </div>
          </div>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <Suspense
              fallback={
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.textSecondary,
                  }}
                >
                  Loading map...
                </div>
              }
            >
              <DirectoryMap
                services={mapServices}
                colors={colors}
                userLocation={userLocation}
                selectedServiceId={selectedService}
                style={{ height: '100%', borderRadius: 0 }}
                dark={dark}
              />
            </Suspense>
            {/* Marker count badge */}
            <div style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              zIndex: 10,
              padding: "6px 14px",
              borderRadius: "20px",
              background: dark ? "rgba(30,31,40,0.88)" : "rgba(255,255,255,0.92)",
              color: colors.text,
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "inherit",
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
              border: `1px solid ${colors.border}`,
            }}>
              {mapServices.length} services
            </div>
          </div>

          {/* Map filter panel overlay — positioned fixed so it sits above the nav bar */}
          {isFilterOpen && (
            <div
              style={{
                position: "fixed",
                top: isMobile ? 71 : 70,
                right: 0,
                bottom: 0,
                width: isMobile ? "100%" : "340px",
                zIndex: 10000,
                background: dark ? "rgba(20, 21, 29, 0.98)" : "rgba(247, 248, 252, 0.98)",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                borderLeft: isMobile ? "none" : `1px solid ${colors.border}`,
                boxShadow: isMobile ? "none" : "-4px 0 24px rgba(0,0,0,0.15)",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Filter panel header */}
                <div style={{
                  padding: "16px 20px",
                  borderBottom: `1px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                  position: isMobile ? "sticky" : "static",
                  top: isMobile ? 0 : undefined,
                  zIndex: isMobile ? 2 : undefined,
                  background: isMobile
                    ? (dark ? "rgba(20, 21, 29, 0.98)" : "rgba(247, 248, 252, 0.98)")
                    : "transparent",
                }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: 0 }}>
                    Filters
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          fontSize: "13px",
                          color: colors.accentText,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      aria-label="Close filters"
                      style={{
                        background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        border: `1px solid ${colors.border}`,
                        padding: "6px 10px",
                        borderRadius: 999,
                        cursor: "pointer",
                        color: colors.text,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <X size={20} />
                      Close
                    </button>
                  </div>
                </div>

                {/* Filter panel body */}
                <div style={{ padding: "16px 20px", flex: 1 }}>
                  {/* Categories */}
                  <div style={{ marginBottom: "16px" }}>
                    <button
                      onClick={() => toggleSection("categories")}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        padding: "8px 0",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Category</span>
                      <ChevronDown size={16} color={colors.textSecondary} style={{
                        transform: expandedSections.has("categories") ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }} />
                    </button>
                    {expandedSections.has("categories") && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {dynamicCategoryOptions.map((cat) => {
                          const Icon = cat.icon;
                          return (
                            <label key={cat.value} style={{
                              display: "flex", alignItems: "center", gap: "10px",
                              cursor: "pointer", padding: "8px 10px", borderRadius: "8px",
                              background: filters.categories.includes(cat.value) ? "rgba(255, 214, 0, 0.1)" : "transparent",
                            }}>
                              <input type="checkbox" checked={filters.categories.includes(cat.value)}
                                onChange={() => toggleCategory(cat.value)}
                                style={{ accentColor: colors.accent, width: 16, height: 16, cursor: "pointer" }} />
                              <Icon size={16} color={colors.textSecondary} />
                              <span style={{ fontSize: "14px", color: colors.text, flex: 1 }}>{cat.label}</span>
                              {categoryFacets[cat.value] !== undefined && (
                                <span style={{ fontSize: "12px", color: colors.textMuted, fontWeight: 500 }}>
                                  {categoryFacets[cat.value]}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Service Type */}
                  {(() => {
                    const typeFacets = searchResult.facets?.service_type || {};
                    const typeEntries = Object.entries(typeFacets).filter(([name]) => name.length > 0).sort((a, b) => b[1] - a[1]);
                    if (typeEntries.length === 0) return null;
                    return (
                      <div style={{ marginBottom: "16px" }}>
                        <button onClick={() => toggleSection("serviceTypes")} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          width: "100%", padding: "8px 0", background: "none", border: "none", cursor: "pointer",
                        }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Type</span>
                          <ChevronDown size={16} color={colors.textSecondary} style={{
                            transform: expandedSections.has("serviceTypes") ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }} />
                        </button>
                        {expandedSections.has("serviceTypes") && (
                          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "240px", overflowY: "auto" }}>
                            {typeEntries.map(([name, count]) => (
                              <label key={name} style={{
                                display: "flex", alignItems: "center", gap: "10px", cursor: "pointer",
                                padding: "6px 10px", borderRadius: "8px",
                                background: filters.serviceTypes.includes(name) ? "rgba(255, 214, 0, 0.1)" : "transparent",
                              }}>
                                <input type="checkbox" checked={filters.serviceTypes.includes(name)}
                                  onChange={() => setFilters((prev) => ({
                                    ...prev,
                                    serviceTypes: prev.serviceTypes.includes(name)
                                      ? prev.serviceTypes.filter((t) => t !== name) : [...prev.serviceTypes, name],
                                  }))}
                                  style={{ accentColor: colors.accent, width: 16, height: 16, cursor: "pointer" }} />
                                <span style={{ fontSize: "13px", color: colors.text, flex: 1 }}>{name}</span>
                                <span style={{ fontSize: "12px", color: colors.textMuted, fontWeight: 500 }}>{count}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Distance Filter */}
                  <div>
                    <button onClick={() => toggleSection("distance")} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      width: "100%", padding: "8px 0", background: "none", border: "none", cursor: "pointer",
                    }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Distance</span>
                      <ChevronDown size={16} color={colors.textSecondary} style={{
                        transform: expandedSections.has("distance") ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }} />
                    </button>
                    {expandedSections.has("distance") && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{
                          padding: "10px 12px",
                          background: userLocation ? "rgba(34, 197, 94, 0.1)" : "rgba(255, 214, 0, 0.1)",
                          borderRadius: "8px",
                          border: `1px solid ${userLocation ? "rgba(34, 197, 94, 0.3)" : colors.border}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <Locate size={14} color={userLocation ? "#22c55e" : colors.accent} />
                            <span style={{ fontSize: "12px", fontWeight: 600, color: colors.text }}>
                              {userLocation ? "Your Location" : "Location Not Set"}
                            </span>
                          </div>
                          {userLocation ? (
                            <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0 }}>{userLocation.label}</p>
                          ) : (
                            <p style={{ fontSize: "11px", color: colors.textMuted, margin: 0 }}>Use button below to set location</p>
                          )}
                        </div>
                        <button
                          onClick={handleGetCurrentLocation}
                          disabled={isLocating}
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            width: "100%", padding: "10px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                            background: colors.accent, color: "#000", border: "none",
                            cursor: isLocating ? "not-allowed" : "pointer", opacity: isLocating ? 0.7 : 1,
                          }}
                        >
                          <Navigation size={14} style={{
                            transform: isLocating ? "rotate(360deg)" : "none", transition: "transform 1s",
                          }} />
                          {isLocating ? "Getting Location..." : "Use My Location"}
                        </button>
                        {userLocation && (
                          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {DISTANCE_OPTIONS.map((option) => (
                              <label key={option.value} style={{
                                display: "flex", alignItems: "center", gap: "10px", cursor: "pointer",
                                padding: "8px 10px", borderRadius: "8px",
                                background: filters.maxDistance === option.value ? "rgba(255, 214, 0, 0.1)" : "transparent",
                              }}>
                                <input type="radio" name="mapDistance" checked={filters.maxDistance === option.value}
                                  onChange={() => setFilters((prev) => ({ ...prev, maxDistance: option.value }))}
                                  style={{ accentColor: colors.accent, width: 16, height: 16 }} />
                                <span style={{ fontSize: "14px", color: colors.text }}>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
          )}
        </div>
      )}

      <SiteFooter />
      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthPopupModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialTab="login" />
        </Suspense>
      )}

      {/* Service Preview Overlay — hierarchy of reveal level 2 */}
      {previewServiceId != null && (() => {
        const previewService = filteredServices.find((s) => s.id === previewServiceId)
          || allMapServices?.find((s) => s.id === previewServiceId);
        if (!previewService) return null;
        return (
          <ServicePreviewOverlay
            service={previewService}
            onClose={() => setPreviewServiceId(null)}
            colors={colors}
            dark={dark}
            userLocation={userLocation}
            isMobile={isMobile}
            formatPhone={formatPhone}
          />
        );
      })()}
    </div>
  );
}

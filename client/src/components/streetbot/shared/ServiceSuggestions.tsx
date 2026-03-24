/**
 * Shared suggestion dropdown for Meilisearch service search.
 * Renders category icons matching the Directory page filter icons.
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Search from "lucide-react/dist/esm/icons/search";
import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import Users from "lucide-react/dist/esm/icons/users";
import Utensils from "lucide-react/dist/esm/icons/utensils";
import Home from "lucide-react/dist/esm/icons/home";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Scale from "lucide-react/dist/esm/icons/scale";
import Briefcase from "lucide-react/dist/esm/icons/briefcase";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap";
import type { ServiceSuggestion } from "./useServiceSuggestions";
import type { LucideIcon } from "lucide-react";

// ── Category → Icon mapping (matches DirectoryPage CATEGORY_OPTIONS exactly) ──
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Health: Stethoscope,
  "Mental Health": Users,
  Food: Utensils,
  "Food Banks": Utensils,
  Shelters: Home,
  Housing: Building2,
  "Housing Services": Building2,
  Legal: Scale,
  "Legal Aid": Scale,
  Employment: Briefcase,
  Education: GraduationCap,
  Programs: GraduationCap,
  "Women Shelter": Home,
  "Women and Children Shelter": Home,
  "Family Shelter": Home,
};

function getCategoryIcon(category: string): LucideIcon {
  // Exact match first
  if (CATEGORY_ICON_MAP[category]) return CATEGORY_ICON_MAP[category];
  // Partial match (e.g. "Housing Services" contains "Housing")
  const lower = category.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (lower.includes(key.toLowerCase())) return icon;
  }
  return Building2;
}

// ── Category color mapping ──
const CATEGORY_COLORS: Record<string, string> = {
  Health: "#ef4444",
  "Mental Health": "#a855f7",
  Food: "#f59e0b",
  Shelters: "#22c55e",
  Housing: "#3b82f6",
  Legal: "#6366f1",
  Employment: "#f97316",
  Education: "#06b6d4",
  Programs: "#06b6d4",
};

function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const lower = category.toLowerCase();
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (lower.includes(key.toLowerCase())) return color;
  }
  return "#6b7280";
}

interface ServiceSuggestionsProps {
  suggestions: ServiceSuggestion[];
  show: boolean;
  dark: boolean;
  /** "desktop" renders larger with hover states; "mobile" renders compact */
  variant?: "desktop" | "mobile";
  onSelect?: (id: number) => void;
  onClose?: () => void;
}

export default function ServiceSuggestions({
  suggestions,
  show,
  dark,
  variant = "desktop",
  onSelect,
  onClose,
}: ServiceSuggestionsProps) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show, onClose]);

  if (!show || suggestions.length === 0) return null;

  const handleSelect = (id: number) => {
    onClose?.();
    if (onSelect) {
      onSelect(id);
    } else {
      navigate(`/directory/service/${id}`);
    }
  };

  const isMobile = variant === "mobile";
  const padY = isMobile ? 8 : 10;
  const padX = isMobile ? 12 : 16;
  const fontSize = isMobile ? 12 : 14;
  const iconSize = isMobile ? 14 : 16;
  const borderRadius = isMobile ? 12 : 16;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        marginTop: 4,
        background: dark ? "rgba(24,24,32,0.97)" : "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
        borderRadius,
        boxShadow: dark
          ? "0 12px 40px rgba(0,0,0,0.5)"
          : "0 12px 40px rgba(0,0,0,0.15)",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      <style>{`mark { background: rgba(59,130,246,0.18); color: inherit; border-radius: 2px; padding: 0 1px; }`}</style>
      {suggestions.map((s, i) => {
        const category = s.category_names?.[0] || "";
        const Icon = category ? getCategoryIcon(category) : Search;
        const iconColor = category ? getCategoryColor(category) : (dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)");

        return (
          <div
            key={s.id}
            onClick={() => handleSelect(s.id)}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(-1)}
            style={{
              padding: `${padY}px ${padX}px`,
              cursor: "pointer",
              fontSize,
              color: dark ? "#fff" : "#1a1c24",
              background:
                hoveredIdx === i
                  ? dark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)"
                  : "transparent",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 8 : 10,
              transition: "background 0.1s",
            }}
          >
            <Icon
              size={iconSize}
              style={{ color: iconColor, flexShrink: 0, opacity: category ? 1 : 0.4 }}
            />
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              dangerouslySetInnerHTML={{
                __html: s._formatted?.name || s.name,
              }}
            />
            <span
              style={{
                fontSize: isMobile ? 10 : 11,
                color: dark ? "rgba(255,255,255,0.45)" : "#888",
                flexShrink: 0,
                display: "flex",
                gap: 6,
              }}
            >
              {category && <span>{category}</span>}
              {s._formatted?.city ? (
                <span dangerouslySetInnerHTML={{ __html: s._formatted.city }} />
              ) : (
                s.city && <span>{s.city}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { getCategoryIcon, getCategoryColor, CATEGORY_ICON_MAP };

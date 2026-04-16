import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Compass,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useAuthContext } from "~/hooks/AuthContext";
import { GlassBackground } from "../shared/GlassBackground";
import { useGlassStyles } from "../shared/useGlassStyles";
import { useResponsive } from "../hooks/useResponsive";
import { SB_API_BASE } from "../shared/apiConfig";
import { useAcademyOverviewData, type AcademyOverviewCertificate } from "../academy/useAcademyOverviewData";
import {
  findAcademyStreetProfileByUserId,
  findAcademyStreetProfileByUsername,
  getAcademyRoleForProfile,
  getInstructorNameForProfile,
  hydrateStreetProfileRecord,
} from "./academyStreetProfiles";
import { ensureStreetProfilesForActiveAcademyUsers, fetchCmsStreetProfileByUsername } from "./academyProfileSync";
import type { StreetProfile } from "./CreativeProfilePage";

type AcademyProfileSectionId =
  | "currently-learning"
  | "completed-courses"
  | "achievements"
  | "activity"
  | "courses-taught"
  | "learning-paths"
  | "live-sessions";

type EditableSectionItem = {
  id: string;
  title: string;
  detail: string;
  badge?: string;
};

type StoredSectionSelection = {
  selectedIds: string[];
  knownItemIds: string[] | null;
};

type SectionMeta = {
  title: string;
  description: string;
  badge: string;
  heroIcon: React.ReactNode;
  rowIcon: React.ReactNode;
  emptyMessage: string;
  addLabel: string;
};

const SETTINGS_STORAGE_KEY = "streetbot:user-settings";

function formatSessionDate(isoDate?: string | null) {
  if (!isoDate) {
    return "Scheduled soon";
  }

  return new Date(isoDate).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeDate(isoDate?: string | null) {
  if (!isoDate) {
    return "Recently";
  }

  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (Number.isNaN(diffMs)) {
    return "Recently";
  }

  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortByNewest<T>(items: T[], pickDate: (item: T) => string | null | undefined) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(pickDate(left) || 0).getTime();
    const rightDate = new Date(pickDate(right) || 0).getTime();
    return rightDate - leftDate;
  });
}

function certificateSortDate(certificate: AcademyOverviewCertificate) {
  return certificate.award_date || certificate.issued_at || certificate.updated_at || null;
}

function readStoredSettings(userId?: string): any {
  try {
    const key = userId ? `${SETTINGS_STORAGE_KEY}:${userId}` : SETTINGS_STORAGE_KEY;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function buildCurrentUserProfile(user: any): StreetProfile | null {
  if (!user) {
    return null;
  }

  const stored = readStoredSettings(user.id);
  const sp = stored.profile || {};
  const academyProfile = findAcademyStreetProfileByUserId(user.id);

  return {
    id: academyProfile?.id || user.id || "me",
    user_id: academyProfile?.user_id || user.id || "me",
    username: user.username || academyProfile?.username || sp.handle?.replace(/^@/, "") || "street_user",
    display_name: user.name || academyProfile?.display_name || sp.name || "Street User",
    primary_roles: sp.title ? [sp.title] : academyProfile?.primary_roles || ["Creative"],
    secondary_skills: academyProfile?.secondary_skills || [],
    bio: sp.bio || academyProfile?.bio || "Building a more equitable world, one block at a time.",
    tagline: sp.bio || academyProfile?.tagline || "",
    avatar_url: user.avatar || sp.avatarUrl || academyProfile?.avatar_url || null,
    cover_url: sp.bannerUrl || academyProfile?.cover_url || null,
    city: sp.location?.split(",")[0]?.trim() || academyProfile?.city || "",
    country: sp.location?.split(",")[1]?.trim() || academyProfile?.country || "",
    location_display: sp.location || academyProfile?.location_display || "",
    portfolio_items: [],
    external_links: [],
    website: sp.website || academyProfile?.website || null,
    availability_status: academyProfile?.availability_status || "open",
    open_to: academyProfile?.open_to || [],
    contact_email: user.email || sp.email || null,
    contact_preference: "form",
    is_public: true,
    is_featured: academyProfile?.is_featured || false,
    is_verified: academyProfile?.is_verified || false,
    followers_count: academyProfile?.followers_count || 0,
    following_count: academyProfile?.following_count || 0,
    saves_count: academyProfile?.saves_count || 0,
    profile_views: academyProfile?.profile_views || 0,
    completeness_score: academyProfile?.completeness_score || 40,
    created_at: academyProfile?.created_at || user.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    academy_role: academyProfile?.academy_role ?? null,
    academy_instructor_name: academyProfile?.academy_instructor_name ?? null,
  };
}

function getSectionSelectionKey(userId: string, section: AcademyProfileSectionId) {
  return `streetbot:academy:profile-section-selection:${userId}:${section}`;
}

function getLegacySectionItemsKey(userId: string, section: AcademyProfileSectionId) {
  return `streetbot:academy:profile-section-items:${userId}:${section}`;
}

function sanitizeSelectedIds(selectedIds: string[], validIds: Set<string>) {
  const seen = new Set<string>();

  return selectedIds.filter((id) => {
    if (!validIds.has(id) || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function readSectionSelection(userId: string, section: AcademyProfileSectionId): StoredSectionSelection | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    const selectionRaw = window.localStorage.getItem(getSectionSelectionKey(userId, section));
    if (selectionRaw !== null) {
      const parsed = JSON.parse(selectionRaw);
      if (Array.isArray(parsed)) {
        return {
          selectedIds: parsed.filter((item): item is string => typeof item === "string"),
          knownItemIds: null,
        };
      }

      if (parsed && typeof parsed === "object") {
        const selectedIds = Array.isArray((parsed as StoredSectionSelection).selectedIds)
          ? (parsed as StoredSectionSelection).selectedIds.filter((item): item is string => typeof item === "string")
          : [];
        const knownItemIds = Array.isArray((parsed as StoredSectionSelection).knownItemIds)
          ? (parsed as StoredSectionSelection).knownItemIds.filter((item): item is string => typeof item === "string")
          : null;

        return {
          selectedIds,
          knownItemIds,
        };
      }

      return {
        selectedIds: [],
        knownItemIds: null,
      };
    }
  } catch {
    return null;
  }

  try {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(getLegacySectionItemsKey(userId, section));
    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? {
          selectedIds: parsed
            .filter(
              (item): item is EditableSectionItem => Boolean(item && typeof item.id === "string"),
            )
            .map((item) => item.id),
          knownItemIds: null,
        }
      : {
          selectedIds: [],
          knownItemIds: null,
        };
  } catch {
    return null;
  }
}

function mergeSectionSelection(
  storedSelection: StoredSectionSelection,
  currentIds: string[],
  validIds: Set<string>,
) {
  const cleanedSelectedIds = sanitizeSelectedIds(storedSelection.selectedIds, validIds);
  const selectedIdSet = new Set(cleanedSelectedIds);
  const knownItemIds = storedSelection.knownItemIds ?? storedSelection.selectedIds;
  const knownItemIdSet = new Set(knownItemIds);
  const newlyAddedItemIds = currentIds.filter((id) => !knownItemIdSet.has(id) && !selectedIdSet.has(id));

  return [...cleanedSelectedIds, ...newlyAddedItemIds];
}

function writeSectionSelection(
  userId: string,
  section: AcademyProfileSectionId,
  selectedIds: string[],
  knownItemIds: string[],
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getSectionSelectionKey(userId, section),
    JSON.stringify({
      selectedIds,
      knownItemIds,
    } satisfies StoredSectionSelection),
  );
  window.localStorage.removeItem(getLegacySectionItemsKey(userId, section));
}

function clearSectionSelection(userId: string, section: AcademyProfileSectionId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getSectionSelectionKey(userId, section));
  window.localStorage.removeItem(getLegacySectionItemsKey(userId, section));
}

function PageCard({
  title,
  description,
  children,
  isDark,
  colors,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isDark: boolean;
  colors: {
    text: string;
    textSecondary: string;
    border?: string;
  };
}) {
  const borderColor = colors.border ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const surface = isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.84)";

  return (
    <section
      style={{
        borderRadius: "24px",
        padding: "24px",
        background: surface,
        border: `1px solid ${borderColor}`,
        boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.22)" : "0 18px 48px rgba(31,41,55,0.08)",
        display: "grid",
        gap: "18px",
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>{title}</h2>
        {description ? (
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: colors.textSecondary }}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DetailRows({
  items,
  icon,
  isDark,
  colors,
}: {
  items: EditableSectionItem[];
  icon?: React.ReactNode;
  isDark: boolean;
  colors: {
    accent: string;
    text: string;
    textSecondary: string;
    border?: string;
  };
}) {
  const borderColor = colors.border ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const surface = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.92)";

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            borderRadius: "18px",
            padding: "16px",
            background: surface,
            border: `1px solid ${borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0 }}>
            {icon ? <div style={{ marginTop: "2px", color: colors.accent, flexShrink: 0 }}>{icon}</div> : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{item.title}</div>
              {item.detail ? (
                <div style={{ marginTop: "4px", fontSize: "13px", lineHeight: 1.5, color: colors.textSecondary }}>
                  {item.detail}
                </div>
              ) : null}
            </div>
          </div>
          {item.badge ? (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: "999px",
                background: "rgba(255,214,0,0.12)",
                color: colors.accent,
                fontSize: "12px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {item.badge}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ManageRows({
  items,
  mode,
  onAdd,
  onRemove,
  onMove,
  selectedIds,
  isDark,
  colors,
}: {
  items: EditableSectionItem[];
  mode: "selected" | "source";
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  selectedIds?: Set<string>;
  isDark: boolean;
  colors: {
    accent: string;
    text: string;
    textSecondary: string;
    border?: string;
  };
}) {
  const borderColor = colors.border ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const surface = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.92)";

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {items.map((item, index) => {
        const isAlreadyAdded = mode === "source" ? selectedIds?.has(item.id) ?? false : false;

        return (
        <div
          key={item.id}
          style={{
            borderRadius: "18px",
            padding: "16px",
            background: surface,
            border: `1px solid ${borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{item.title}</div>
            {item.detail ? (
              <div style={{ marginTop: "4px", fontSize: "13px", lineHeight: 1.5, color: colors.textSecondary }}>
                {item.detail}
              </div>
            ) : null}
            {item.badge ? (
              <div
                style={{
                  marginTop: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background: "rgba(255,214,0,0.12)",
                  color: colors.accent,
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {item.badge}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {mode === "selected" ? (
              <>
                <button
                  type="button"
                  onClick={() => onMove(item.id, "up")}
                  disabled={index === 0}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 12px",
                    borderRadius: "999px",
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
                    color: colors.text,
                    border: `1px solid ${borderColor}`,
                    fontWeight: 700,
                    cursor: index === 0 ? "not-allowed" : "pointer",
                    opacity: index === 0 ? 0.5 : 1,
                  }}
                >
                  <ArrowUp size={14} />
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.id, "down")}
                  disabled={index === items.length - 1}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 12px",
                    borderRadius: "999px",
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
                    color: colors.text,
                    border: `1px solid ${borderColor}`,
                    fontWeight: 700,
                    cursor: index === items.length - 1 ? "not-allowed" : "pointer",
                    opacity: index === items.length - 1 ? 0.5 : 1,
                  }}
                >
                  <ArrowDown size={14} />
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 14px",
                    borderRadius: "999px",
                    background: "rgba(239,68,68,0.12)",
                    color: isDark ? "#FCA5A5" : "#B91C1C",
                    border: `1px solid ${isDark ? "rgba(248,113,113,0.2)" : "rgba(239,68,68,0.2)"}`,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onAdd(item.id)}
                disabled={isAlreadyAdded}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 14px",
                  borderRadius: "999px",
                  background: isAlreadyAdded
                    ? isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(255,255,255,0.72)"
                    : "rgba(34,197,94,0.12)",
                  color: isAlreadyAdded ? colors.textSecondary : isDark ? "#86EFAC" : "#166534",
                  border: `1px solid ${
                    isAlreadyAdded
                      ? borderColor
                      : isDark
                        ? "rgba(74,222,128,0.22)"
                        : "rgba(34,197,94,0.18)"
                  }`,
                  fontWeight: 700,
                  cursor: isAlreadyAdded ? "not-allowed" : "pointer",
                  opacity: isAlreadyAdded ? 0.75 : 1,
                }}
              >
                <Plus size={14} />
                {isAlreadyAdded ? "Added" : "Add"}
              </button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  message,
  isDark,
  colors,
}: {
  message: string;
  isDark: boolean;
  colors: {
    textSecondary: string;
    border?: string;
  };
}) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "18px",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        color: colors.textSecondary,
        fontSize: "14px",
        lineHeight: 1.6,
      }}
    >
      {message}
    </div>
  );
}

export default function StreetProfileAcademySectionPage() {
  const { username, section } = useParams<{ username?: string; section?: string }>();
  const location = useLocation();
  const { user } = useAuthContext();
  const { isDark, colors: sharedColors } = useGlassStyles();
  const { isMobile } = useResponsive();

  const colors = useMemo(
    () => ({
      ...sharedColors,
      accentText: isDark ? "#FFD600" : "#000",
    }),
    [sharedColors, isDark],
  );

  const isSettingsRoute = location.pathname.startsWith("/settings");
  const settingsProfile = useMemo(() => buildCurrentUserProfile(user), [user]);
  const [profile, setProfile] = useState<StreetProfile | null>(isSettingsRoute ? settingsProfile : null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setProfileLoading(true);
      setProfileError(null);

      if (isSettingsRoute) {
        if (isMounted) {
          setProfile(settingsProfile);
          setProfileError(settingsProfile ? null : "Profile not found");
          setProfileLoading(false);
        }
        return;
      }

      if (!username) {
        if (isMounted) {
          setProfile(null);
          setProfileError("Profile not found");
          setProfileLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${SB_API_BASE}/street-profiles/${encodeURIComponent(username)}`);
        if (!response.ok) {
          await ensureStreetProfilesForActiveAcademyUsers().catch(() => []);
          const cmsProfile = await fetchCmsStreetProfileByUsername(username).catch(() => null);
          const fallbackProfile = cmsProfile
            ? hydrateStreetProfileRecord(cmsProfile as any)
            : findAcademyStreetProfileByUsername(username);
          if (fallbackProfile) {
            if (isMounted) {
              setProfile(fallbackProfile);
              setProfileLoading(false);
            }
            return;
          }
          throw new Error(`Profile not found (${response.status})`);
        }

        const data = await response.json();
        if (isMounted) {
          setProfile(data);
        }
      } catch (error: any) {
        await ensureStreetProfilesForActiveAcademyUsers().catch(() => []);
        const cmsProfile = await fetchCmsStreetProfileByUsername(username).catch(() => null);
        const fallbackProfile = cmsProfile
          ? hydrateStreetProfileRecord(cmsProfile as any)
          : findAcademyStreetProfileByUsername(username);
        if (fallbackProfile) {
          if (isMounted) {
            setProfile(fallbackProfile);
            setProfileLoading(false);
          }
          return;
        }

        if (isMounted) {
          setProfile(null);
          setProfileError(error?.message || "Profile not found");
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isSettingsRoute, settingsProfile, username]);

  const academyRole = getAcademyRoleForProfile(profile);
  const instructorName = getInstructorNameForProfile(profile);
  const {
    targetUserId,
    role,
    hasAcademyData,
    paths,
    loading,
    publishedCourses,
    activeEnrollments,
    enrolledUpcomingSessions,
    enrollmentByCourseId,
    enrolledCourses,
    enrolledPathSummaries,
    recommendedPath,
    certificates,
    inProgressCoursesCount,
    completedCoursesCount,
    instructorCourses,
    instructorSessions,
    instructorCourseEnrollmentMap,
  } = useAcademyOverviewData({
    academyUserId: profile?.user_id,
    academyRole,
    instructorName,
    enabled: Boolean(profile?.user_id),
  });

  const effectiveRole = role ?? academyRole ?? "student";
  const canEditProfile = Boolean(user?.id && profile?.user_id === user.id);
  const normalizedSection = String(section || "").trim().toLowerCase() as AcademyProfileSectionId;
  const backHref = isSettingsRoute
    ? "/settings?tab=academy"
    : profile
      ? `/creatives/${profile.username}?tab=academy`
      : "/profile?tab=academy";

  const currentPath = useMemo(() => {
    const inFlight = enrolledPathSummaries
      .filter((summary) => summary.progress > 0 && summary.progress < 100)
      .sort((left, right) => right.progress - left.progress)[0];
    return inFlight ?? recommendedPath;
  }, [enrolledPathSummaries, recommendedPath]);

  const currentCourses = useMemo(
    () =>
      enrolledCourses
        .filter((course) => {
          const progress = enrollmentByCourseId[course.id]?.progress_percent ?? 0;
          return progress > 0 && progress < 100;
        })
        .sort(
          (left, right) =>
            (enrollmentByCourseId[right.id]?.progress_percent ?? 0) -
            (enrollmentByCourseId[left.id]?.progress_percent ?? 0),
        ),
    [enrolledCourses, enrollmentByCourseId],
  );

  const completedCourses = useMemo(
    () =>
      sortByNewest(
        enrolledCourses.filter((course) => (enrollmentByCourseId[course.id]?.progress_percent ?? 0) >= 100),
        (course) => enrollmentByCourseId[course.id]?.completed_at || enrollmentByCourseId[course.id]?.last_accessed_at,
      ),
    [enrolledCourses, enrollmentByCourseId],
  );

  const pathById = useMemo(() => {
    const map = new Map<string, (typeof paths)[number]>();
    paths.forEach((path) => {
      map.set(path.slug, path);
      if (path.id) {
        map.set(path.id, path);
      }
    });
    return map;
  }, [paths]);

  const courseById = useMemo(
    () => new Map(publishedCourses.map((course) => [course.id, course])),
    [publishedCourses],
  );

  const achievementItems = useMemo(() => {
    const certificateItems = sortByNewest(certificates, certificateSortDate).map((certificate) => {
      const isPathCertificate =
        certificate.target_type === "learning_path" || Boolean(certificate.learning_path_id);
      const targetId = certificate.target_id || certificate.learning_path_id || certificate.course_id || certificate.id;
      const matchingPath = isPathCertificate ? pathById.get(targetId || "") : null;
      const matchingCourse = certificate.course_id ? courseById.get(certificate.course_id) : null;
      const title =
        certificate.target_title ||
        matchingPath?.title ||
        matchingCourse?.title ||
        certificate.certificate_title ||
        "Academy achievement";

      return {
        id: certificate.id,
        title: isPathCertificate ? `${title} - Completed` : `Certificate: ${certificate.certificate_title || title}`,
        detail: isPathCertificate
          ? "Completed learning path"
          : `Issued ${formatRelativeDate(certificateSortDate(certificate))}`,
      };
    });

    const fallbackPathAchievements = enrolledPathSummaries
      .filter((summary) => summary.progress >= 100)
      .map((summary) => ({
        id: `path-${summary.path.slug}`,
        title: `${summary.path.title} - Completed`,
        detail: "Completed learning path",
      }));

    return Array.from(
      new Map(
        [...certificateItems, ...fallbackPathAchievements].map((item) => [item.title.toLowerCase(), item]),
      ).values(),
    );
  }, [certificates, courseById, enrolledPathSummaries, pathById]);

  const lastActiveAt = useMemo(() => {
    const timestamps = activeEnrollments
      .map((enrollment) => enrollment.last_accessed_at)
      .filter((value): value is string => Boolean(value));
    return sortByNewest(timestamps, (value) => value)[0] ?? null;
  }, [activeEnrollments]);

  const recentActivityItems = useMemo(() => {
    const items: EditableSectionItem[] = [];

    if (lastActiveAt) {
      items.push({
        id: "last-active",
        title: `Last active ${formatRelativeDate(lastActiveAt)}`,
        detail: "Still showing up and building momentum in Academy.",
      });
    }

    completedCourses.forEach((course) => {
      items.push({
        id: `completed-${course.id}`,
        title: `Completed ${course.title}`,
        detail: `Finished ${formatRelativeDate(
          enrollmentByCourseId[course.id]?.completed_at || enrollmentByCourseId[course.id]?.last_accessed_at,
        )}`,
      });
    });

    enrolledUpcomingSessions.forEach((session) => {
      items.push({
        id: `session-${session.id}`,
        title: session.title,
        detail: `Upcoming live session - ${formatSessionDate(session.scheduled_start)}`,
      });
    });

    return items;
  }, [completedCourses, enrolledUpcomingSessions, enrollmentByCourseId, lastActiveAt]);

  const instructorCourseSummaries = useMemo(
    () =>
      instructorCourses
        .map((course) => {
          const enrollments = (instructorCourseEnrollmentMap[course.id] || []).filter(
            (enrollment) => enrollment.status !== "dropped",
          );
          const studentCount = new Set(enrollments.map((enrollment) => enrollment.user_id)).size;
          const activeStudentCount = enrollments.filter((enrollment) => enrollment.progress_percent < 100).length;

          return {
            course,
            studentCount,
            activeStudentCount,
            statusLabel: activeStudentCount > 0 || course.state === "published" ? "Active" : "Completed",
          };
        })
        .sort((left, right) => right.studentCount - left.studentCount),
    [instructorCourseEnrollmentMap, instructorCourses],
  );

  const instructorCourseIds = useMemo(
    () => new Set(instructorCourses.map((course) => course.id)),
    [instructorCourses],
  );

  const instructorPaths = useMemo(
    () =>
      paths.filter((path) => {
        const createdByInstructor = Boolean(targetUserId) && path.createdBy === targetUserId;
        const pathCourseIds = Array.isArray(path.courseIds) ? path.courseIds : [];
        const includesInstructorCourse = pathCourseIds.some((courseId) => instructorCourseIds.has(courseId));
        return createdByInstructor || includesInstructorCourse;
      }),
    [instructorCourseIds, paths, targetUserId],
  );

  const sortedInstructorSessions = useMemo(
    () =>
      [...instructorSessions].sort(
        (left, right) => new Date(right.scheduled_start).getTime() - new Date(left.scheduled_start).getTime(),
      ),
    [instructorSessions],
  );

  const validStudentSections: AcademyProfileSectionId[] = [
    "currently-learning",
    "completed-courses",
    "achievements",
    "activity",
  ];
  const validInstructorSections: AcademyProfileSectionId[] = [
    "courses-taught",
    "learning-paths",
    "live-sessions",
  ];
  const validSections = effectiveRole === "instructor" ? validInstructorSections : validStudentSections;
  const hasValidSection = validSections.includes(normalizedSection);

  const sectionMeta = useMemo<SectionMeta | null>(() => {
    switch (normalizedSection) {
      case "currently-learning":
        return {
          title: "Currently Learning",
          description: "Everything this student is learning right now, in one list they can keep current.",
          badge: "Student Academy",
          heroIcon: <Target size={16} />,
          rowIcon: <BookOpen size={16} />,
          emptyMessage: "There are no currently learning items to show yet.",
          addLabel: "Add learning item",
        };
      case "completed-courses":
        return {
          title: "Completed Courses",
          description: "A full list of the courses this student has completed through Street Voices Academy.",
          badge: "Student Academy",
          heroIcon: <CheckCircle2 size={16} />,
          rowIcon: <CheckCircle2 size={16} />,
          emptyMessage: "There are no completed courses to show yet.",
          addLabel: "Add completed course",
        };
      case "achievements":
        return {
          title: "Achievements",
          description: "Certificates, completed paths, and milestones that show this student's progress.",
          badge: "Student Academy",
          heroIcon: <Award size={16} />,
          rowIcon: <Award size={16} />,
          emptyMessage: "There are no achievements to show yet.",
          addLabel: "Add achievement",
        };
      case "activity":
        return {
          title: "Activity",
          description: "Recent Academy movement, including logins, completions, and upcoming sessions.",
          badge: "Student Academy",
          heroIcon: <CalendarDays size={16} />,
          rowIcon: <CalendarDays size={16} />,
          emptyMessage: "There is no activity to show yet.",
          addLabel: "Add activity item",
        };
      case "courses-taught":
        return {
          title: "Courses Taught",
          description: "A full list of the courses this instructor teaches and the learner activity around them.",
          badge: "Instructor Academy",
          heroIcon: <BookOpen size={16} />,
          rowIcon: <BookOpen size={16} />,
          emptyMessage: "There are no taught courses to show yet.",
          addLabel: "Add taught course",
        };
      case "learning-paths":
        return {
          title: "Learning Paths",
          description: "Every learning path this instructor has created or contributed to through Academy.",
          badge: "Instructor Academy",
          heroIcon: <Compass size={16} />,
          rowIcon: <Compass size={16} />,
          emptyMessage: "There are no learning paths to show yet.",
          addLabel: "Add learning path",
        };
      case "live-sessions":
        return {
          title: "Live Sessions",
          description: "All hosted sessions and workshops connected to this instructor's Academy work.",
          badge: "Instructor Academy",
          heroIcon: <Video size={16} />,
          rowIcon: <Video size={16} />,
          emptyMessage: "There are no live sessions to show yet.",
          addLabel: "Add live session",
        };
      default:
        return null;
    }
  }, [normalizedSection]);

  const defaultSectionItems = useMemo<EditableSectionItem[]>(() => {
    switch (normalizedSection) {
      case "currently-learning": {
        const items: EditableSectionItem[] = [];
        if (currentPath) {
          items.push({
            id: `path-${currentPath.path.slug}`,
            title: currentPath.path.title,
            detail: `Learning path - ${currentPath.progress}% complete`,
            badge: `${currentPath.progress}% complete`,
          });
        }

        currentCourses.forEach((course) => {
          items.push({
            id: course.id,
            title: course.title,
            detail: "Current course",
            badge: `${enrollmentByCourseId[course.id]?.progress_percent ?? 0}% complete`,
          });
        });

        return items;
      }
      case "completed-courses":
        return completedCourses.map((course) => ({
          id: course.id,
          title: course.title,
          detail: `Completed ${formatRelativeDate(
            enrollmentByCourseId[course.id]?.completed_at || enrollmentByCourseId[course.id]?.last_accessed_at,
          )}`,
        }));
      case "achievements":
        return achievementItems.map((item) => ({
          id: item.id,
          title: item.title,
          detail: item.detail || "",
        }));
      case "activity":
        return recentActivityItems;
      case "courses-taught":
        return instructorCourseSummaries.map((summary) => ({
          id: summary.course.id,
          title: summary.course.title,
          detail: `${summary.studentCount} ${summary.studentCount === 1 ? "student" : "students"} - ${summary.statusLabel}`,
          badge: summary.statusLabel,
        }));
      case "learning-paths":
        return instructorPaths.map((path) => ({
          id: path.slug,
          title: path.title,
          detail: `${Array.isArray(path.courseIds) && path.courseIds.length > 0 ? path.courseIds.length : path.courses} courses - ${path.hours} hours`,
        }));
      case "live-sessions":
        return sortedInstructorSessions.map((session) => ({
          id: session.id,
          title: session.title,
          detail: `${formatSessionDate(session.scheduled_start)} - ${session.status === "scheduled" ? "Scheduled" : "Completed"}`,
        }));
      default:
        return [];
    }
  }, [
    achievementItems,
    completedCourses,
    currentCourses,
    currentPath,
    enrollmentByCourseId,
    instructorCourseSummaries,
    instructorPaths,
    normalizedSection,
    recentActivityItems,
    sortedInstructorSessions,
  ]);

  const allSectionItems = useMemo(
    () => Array.from(new Map(defaultSectionItems.map((item) => [item.id, item])).values()),
    [defaultSectionItems],
  );
  const allSectionItemIds = useMemo(() => allSectionItems.map((item) => item.id), [allSectionItems]);
  const allSectionItemIdsSet = useMemo(() => new Set(allSectionItemIds), [allSectionItemIds]);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [draftSelectedItemIds, setDraftSelectedItemIds] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddChooserOpen, setIsAddChooserOpen] = useState(false);

  useEffect(() => {
    if (!profile?.user_id || !hasValidSection) {
      setSelectedItemIds([]);
      setDraftSelectedItemIds([]);
      setIsEditMode(false);
      setIsAddChooserOpen(false);
      return;
    }

    const storedSelection = readSectionSelection(profile.user_id, normalizedSection);
    const nextSelection =
      storedSelection === null
        ? allSectionItemIds
        : mergeSectionSelection(storedSelection, allSectionItemIds, allSectionItemIdsSet);

    setSelectedItemIds(nextSelection);
    setDraftSelectedItemIds(nextSelection);
    setIsEditMode(false);
    setIsAddChooserOpen(false);
  }, [allSectionItemIds, allSectionItemIdsSet, hasValidSection, normalizedSection, profile?.user_id]);

  const sectionItems = useMemo(
    () =>
      selectedItemIds
        .map((itemId) => allSectionItems.find((item) => item.id === itemId))
        .filter((item): item is EditableSectionItem => Boolean(item)),
    [allSectionItems, selectedItemIds],
  );
  const draftItems = useMemo(
    () =>
      draftSelectedItemIds
        .map((itemId) => allSectionItems.find((item) => item.id === itemId))
        .filter((item): item is EditableSectionItem => Boolean(item)),
    [allSectionItems, draftSelectedItemIds],
  );
  const draftSelectedItemIdSet = useMemo(() => new Set(draftSelectedItemIds), [draftSelectedItemIds]);
  const availableDraftItems = useMemo(
    () => allSectionItems.filter((item) => !draftSelectedItemIds.includes(item.id)),
    [allSectionItems, draftSelectedItemIds],
  );

  const borderColor = colors.border ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const surfaceStrong = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.94)";

  function persistSectionSelection(nextSelection: string[]) {
    if (!profile?.user_id || !hasValidSection) {
      return;
    }

    const cleanedSelection = sanitizeSelectedIds(nextSelection, allSectionItemIdsSet);
    setSelectedItemIds(cleanedSelection);
    setDraftSelectedItemIds(cleanedSelection);
    writeSectionSelection(profile.user_id, normalizedSection, cleanedSelection, allSectionItemIds);
  }

  function handleStartEditing() {
    setDraftSelectedItemIds(selectedItemIds);
    setIsEditMode(true);
    setIsAddChooserOpen(false);
  }

  function handleCancelEditing() {
    setDraftSelectedItemIds(selectedItemIds);
    setIsEditMode(false);
    setIsAddChooserOpen(false);
  }

  function handleSaveEditing() {
    persistSectionSelection(draftSelectedItemIds);
    setIsEditMode(false);
    setIsAddChooserOpen(false);
  }

  function handleResetToAcademyDefaults() {
    if (!profile?.user_id || !hasValidSection) {
      return;
    }

    clearSectionSelection(profile.user_id, normalizedSection);
    setSelectedItemIds(allSectionItemIds);
    setDraftSelectedItemIds(allSectionItemIds);
    setIsEditMode(false);
    setIsAddChooserOpen(false);
  }

  function handleAddItem(id: string) {
    setDraftSelectedItemIds((currentIds) => (currentIds.includes(id) ? currentIds : [...currentIds, id]));
  }

  function handleRemoveItem(id: string) {
    setDraftSelectedItemIds((currentIds) => currentIds.filter((itemId) => itemId !== id));
  }

  function handleMoveItem(id: string, direction: "up" | "down") {
    setDraftSelectedItemIds((currentIds) => {
      const currentIndex = currentIds.indexOf(id);
      if (currentIndex === -1) {
        return currentIds;
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentIds.length) {
        return currentIds;
      }

      const nextIds = [...currentIds];
      [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];
      return nextIds;
    });
  }

  if (profileLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <GlassBackground />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            color: colors.textSecondary,
            position: "relative",
            zIndex: 1,
          }}
        >
          Loading Academy section...
        </div>
      </div>
    );
  }

  if (profileError || !profile || !sectionMeta || !hasValidSection || !hasAcademyData) {
    return (
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <GlassBackground />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            position: "relative",
            zIndex: 1,
            padding: "24px",
          }}
        >
          <PageCard
            title="Academy section unavailable"
            description={
              profileError ||
              (!hasAcademyData
                ? "This profile is not connected to Street Voices Academy yet."
                : "This Academy section is not available for this profile.")
            }
            isDark={isDark}
            colors={colors}
          >
            <div>
              <Link
                to={backHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 16px",
                  borderRadius: "999px",
                  background: colors.accent,
                  color: "#000",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <ArrowLeft size={16} />
                Go Back
              </Link>
            </div>
          </PageCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <GlassBackground />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: isMobile ? "16px" : "32px",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <Link
              to={backHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "999px",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
                color: colors.text,
                textDecoration: "none",
                fontWeight: 700,
                border: `1px solid ${borderColor}`,
              }}
            >
              <ArrowLeft size={16} />
              Go Back
            </Link>

            {canEditProfile ? (
              isEditMode ? (
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleSaveEditing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 16px",
                      borderRadius: "999px",
                      background: colors.accent,
                      color: "#000",
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Save size={16} />
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 16px",
                      borderRadius: "999px",
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
                      color: colors.text,
                      border: `1px solid ${borderColor}`,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    borderRadius: "999px",
                    background: colors.accent,
                    color: "#000",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Pencil size={16} />
                  Update Details
                </button>
              )
            ) : null}
          </div>

          <section
            style={{
              borderRadius: "28px",
              padding: isMobile ? "24px" : "32px",
              background: isDark
                ? "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(59,130,246,0.08) 55%, rgba(16,185,129,0.08))"
                : "linear-gradient(135deg, rgba(255,214,0,0.14), rgba(59,130,246,0.08) 55%, rgba(16,185,129,0.08))",
              border: `1px solid ${borderColor}`,
              boxShadow: isDark ? "0 18px 48px rgba(0,0,0,0.22)" : "0 18px 48px rgba(31,41,55,0.08)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "999px",
                background: "rgba(255,214,0,0.14)",
                color: colors.accent,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {sectionMeta.heroIcon}
              {sectionMeta.badge}
            </div>
            <h1 style={{ margin: "16px 0 10px 0", fontSize: isMobile ? "28px" : "34px", lineHeight: 1.1, fontWeight: 800, color: colors.text }}>
              {sectionMeta.title}
            </h1>
            <p style={{ margin: 0, maxWidth: "820px", fontSize: "15px", lineHeight: 1.6, color: colors.textSecondary }}>
              {profile.display_name}'s Academy section is connected directly to the Street Profile system. {sectionMeta.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "24px" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "999px",
                  background: surfaceStrong,
                  color: colors.textSecondary,
                  fontSize: "13px",
                  fontWeight: 600,
                  border: `1px solid ${borderColor}`,
                }}
              >
                {effectiveRole === "instructor" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={14} /> Instructor Profile
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <Target size={14} /> Student Profile
                  </span>
                )}
              </div>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "999px",
                  background: surfaceStrong,
                  color: colors.textSecondary,
                  fontSize: "13px",
                  fontWeight: 600,
                  border: `1px solid ${borderColor}`,
                }}
              >
                {sectionItems.length} {sectionItems.length === 1 ? "detail" : "details"}
              </div>
              {effectiveRole === "student" ? (
                <>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "999px",
                      background: surfaceStrong,
                      color: colors.textSecondary,
                      fontSize: "13px",
                      fontWeight: 600,
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    {inProgressCoursesCount} in progress
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "999px",
                      background: surfaceStrong,
                      color: colors.textSecondary,
                      fontSize: "13px",
                      fontWeight: 600,
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    {completedCoursesCount} completed
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <PageCard
            title={isEditMode ? `Edit ${sectionMeta.title}` : sectionMeta.title}
            description={
              isEditMode
                ? "Choose which authentic Academy details appear on this page. You can add, remove, and reorder them without typing a status update."
                : "This page shows the full list of details for this Academy section."
            }
            isDark={isDark}
            colors={colors}
          >
            {isEditMode && canEditProfile ? (
              <>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setIsAddChooserOpen((current) => !current)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 16px",
                      borderRadius: "999px",
                      background: colors.accent,
                      color: "#000",
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={16} />
                    {sectionMeta.addLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToAcademyDefaults}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 16px",
                      borderRadius: "999px",
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
                      color: colors.text,
                      border: `1px solid ${borderColor}`,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <RotateCcw size={16} />
                    Reset to Academy Data
                  </button>
                </div>

                <div style={{ display: "grid", gap: "18px" }}>
                  <section
                    style={{
                      borderRadius: "20px",
                      padding: "18px",
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.72)",
                      border: `1px solid ${borderColor}`,
                      display: "grid",
                      gap: "14px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: colors.text }}>Showing On This Page</div>
                      <div style={{ marginTop: "4px", fontSize: "13px", lineHeight: 1.5, color: colors.textSecondary }}>
                        Remove anything you do not want visible, or move items up and down to change the order.
                      </div>
                    </div>

                    {draftItems.length > 0 ? (
                      <ManageRows
                        items={draftItems}
                        mode="selected"
                        onAdd={handleAddItem}
                        onRemove={handleRemoveItem}
                        onMove={handleMoveItem}
                        isDark={isDark}
                        colors={colors}
                      />
                    ) : (
                      <EmptyState
                        message="This page is empty right now. Use the Academy details below to add items back in."
                        isDark={isDark}
                        colors={colors}
                      />
                    )}
                  </section>

                  {isAddChooserOpen ? (
                    <section
                      style={{
                        borderRadius: "20px",
                        padding: "18px",
                        background: isDark
                          ? "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(59,130,246,0.06))"
                          : "linear-gradient(135deg, rgba(255,214,0,0.14), rgba(59,130,246,0.08))",
                        border: `1px solid ${borderColor}`,
                        display: "grid",
                        gap: "14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: "16px", fontWeight: 800, color: colors.text }}>Choose What To Add</div>
                          <div style={{ marginTop: "4px", fontSize: "13px", lineHeight: 1.5, color: colors.textSecondary }}>
                            Pick from the authentic Academy details for this page. When you click add, it joins the list above and saves when you press Save Changes.
                          </div>
                        </div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 12px",
                            borderRadius: "999px",
                            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
                            color: colors.text,
                            fontSize: "12px",
                            fontWeight: 700,
                            border: `1px solid ${borderColor}`,
                          }}
                        >
                          <Plus size={14} />
                          {availableDraftItems.length} available to add
                        </div>
                      </div>

                      {allSectionItems.length > 0 ? (
                        <ManageRows
                          items={allSectionItems}
                          mode="source"
                          onAdd={handleAddItem}
                          onRemove={handleRemoveItem}
                          onMove={handleMoveItem}
                          selectedIds={draftSelectedItemIdSet}
                          isDark={isDark}
                          colors={colors}
                        />
                      ) : (
                        <EmptyState
                          message="There are no Academy details available for this section yet."
                          isDark={isDark}
                          colors={colors}
                        />
                      )}
                    </section>
                  ) : null}
                </div>
              </>
            ) : sectionItems.length > 0 ? (
              <DetailRows
                items={sectionItems}
                icon={sectionMeta.rowIcon}
                isDark={isDark}
                colors={colors}
              />
            ) : (
              <EmptyState message={sectionMeta.emptyMessage} isDark={isDark} colors={colors} />
            )}
          </PageCard>
        </div>
      </div>
    </div>
  );
}

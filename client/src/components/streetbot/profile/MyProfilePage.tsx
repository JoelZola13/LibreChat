/**
 * MyProfilePage — Renders the CreativeProfilePage for the currently logged-in
 * user, constructing profile data from auth context + localStorage settings.
 * Used by the /settings route so "Street Profile" dropdown shows the new page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';
import { useAcademyUserId } from '../academy/useAcademyUserId';
import CreativeProfilePage, { type StreetProfile } from './CreativeProfilePage';
import { ensureStreetProfileForAcademyUser } from './academyProfileSync';
import { findAcademyStreetProfileByUserId } from './academyStreetProfiles';

const SETTINGS_STORAGE_KEY = 'streetbot:user-settings';

function readStoredSettings(userId?: string): any {
  try {
    const key = userId ? `${SETTINGS_STORAGE_KEY}:${userId}` : SETTINGS_STORAGE_KEY;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function MyProfilePage() {
  const { user } = useAuthContext();
  const academyUserId = useAcademyUserId();
  const [syncedProfile, setSyncedProfile] = useState<Partial<StreetProfile> | null>(null);

  useEffect(() => {
    let isMounted = true;

    void ensureStreetProfileForAcademyUser({
      userId: academyUserId || user?.id,
      user,
      roleHint: "student",
    }).then((profile) => {
      if (isMounted && profile) {
        setSyncedProfile(profile as Partial<StreetProfile>);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [academyUserId, user]);

  const profile = useMemo(() => {
    const effectiveUserId = academyUserId || user?.id;
    const stored = readStoredSettings(effectiveUserId);
    const sp = stored.profile || {};
    const academyProfile = findAcademyStreetProfileByUserId(effectiveUserId);

    return ({
      id: syncedProfile?.id || academyProfile?.id || effectiveUserId || 'me',
      user_id: syncedProfile?.user_id || academyProfile?.user_id || effectiveUserId || 'me',
      username:
        syncedProfile?.username ||
        user?.username ||
        academyProfile?.username ||
        sp.handle?.replace(/^@/, '') ||
        'street_user',
      display_name: syncedProfile?.display_name || user?.name || academyProfile?.display_name || sp.name || 'Street User',
      primary_roles:
        sp.title ? [sp.title] : syncedProfile?.primary_roles || academyProfile?.primary_roles || ['Creative'],
      secondary_skills: syncedProfile?.secondary_skills || academyProfile?.secondary_skills || [],
      bio:
        sp.bio ||
        syncedProfile?.bio ||
        academyProfile?.bio ||
        'Building a more equitable world, one block at a time.',
      tagline: sp.bio || syncedProfile?.tagline || academyProfile?.tagline || '',
      avatar_url: user?.avatar || sp.avatarUrl || syncedProfile?.avatar_url || academyProfile?.avatar_url || null,
      cover_url: sp.bannerUrl || syncedProfile?.cover_url || academyProfile?.cover_url || null,
      city: sp.location?.split(',')[0]?.trim() || syncedProfile?.city || academyProfile?.city || '',
      country: sp.location?.split(',')[1]?.trim() || syncedProfile?.country || academyProfile?.country || '',
      location_display: sp.location || syncedProfile?.location_display || academyProfile?.location_display || '',
      portfolio_items: [],
      external_links: [],
      website: sp.website || syncedProfile?.website || academyProfile?.website || null,
      availability_status: syncedProfile?.availability_status || academyProfile?.availability_status || 'open',
      open_to: syncedProfile?.open_to || academyProfile?.open_to || [],
      contact_email: user?.email || sp.email || null,
      contact_preference: 'form',
      is_public: true,
      is_featured: syncedProfile?.is_featured || academyProfile?.is_featured || false,
      is_verified: syncedProfile?.is_verified || academyProfile?.is_verified || false,
      followers_count: syncedProfile?.followers_count || academyProfile?.followers_count || 0,
      following_count: syncedProfile?.following_count || academyProfile?.following_count || 0,
      saves_count: syncedProfile?.saves_count || academyProfile?.saves_count || 0,
      profile_views: syncedProfile?.profile_views || academyProfile?.profile_views || 0,
      completeness_score: syncedProfile?.completeness_score || academyProfile?.completeness_score || 40,
      created_at: syncedProfile?.created_at || academyProfile?.created_at || user?.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      academy_role: syncedProfile?.academy_role ?? academyProfile?.academy_role ?? null,
      academy_instructor_name:
        syncedProfile?.academy_instructor_name ?? academyProfile?.academy_instructor_name ?? null,
    }) as StreetProfile;
  }, [academyUserId, syncedProfile, user?.id, user?.username, user?.name, user?.avatar, user?.email, user?.createdAt]);

  return <CreativeProfilePage initialProfile={profile} />;
}

/**
 * MyProfilePage — Renders the CreativeProfilePage for the currently logged-in
 * user, constructing profile data from auth context + localStorage settings.
 * Used by the /settings route so "Street Profile" dropdown shows the new page.
 */
import { useMemo } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';
import CreativeProfilePage, { type StreetProfile } from './CreativeProfilePage';

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

  const profile = useMemo(() => {
    const stored = readStoredSettings(user?.id);
    const sp = stored.profile || {};

    return ({
      id: user?.id || 'me',
      user_id: user?.id || 'me',
      username: user?.username || sp.handle?.replace(/^@/, '') || 'street_user',
      display_name: user?.name || sp.name || 'Street User',
      primary_roles: sp.title ? [sp.title] : ['Creative'],
      secondary_skills: [],
      bio: sp.bio || 'Building a more equitable world, one block at a time.',
      tagline: sp.bio || '',
      avatar_url: user?.avatar || sp.avatarUrl || null,
      cover_url: sp.bannerUrl || null,
      city: sp.location?.split(',')[0]?.trim() || '',
      country: sp.location?.split(',')[1]?.trim() || '',
      location_display: sp.location || '',
      portfolio_items: [],
      external_links: [],
      website: sp.website || null,
      availability_status: 'open',
      open_to: [],
      contact_email: user?.email || sp.email || null,
      contact_preference: 'form',
      is_public: true,
      is_featured: false,
      is_verified: false,
      followers_count: 0,
      following_count: 0,
      saves_count: 0,
      profile_views: 0,
      completeness_score: 40,
      created_at: user?.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }) as StreetProfile;
  }, [user?.id, user?.username, user?.name, user?.avatar, user?.email, user?.createdAt]);

  return <CreativeProfilePage initialProfile={profile} />;
}

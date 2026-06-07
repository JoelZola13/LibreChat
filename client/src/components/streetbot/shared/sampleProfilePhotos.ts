import { getStreetProfileAvatarUrl } from '../profile/profileAvatarResolver';

const SAMPLE_PROFILE_PHOTO_NAMES: Record<string, number> = {
  'aaliyah morgan': 47,
  'marcus lee': 12,
  'sofia alvarez': 32,
  'daniel kim': 68,
  'jasmine patel': 44,
  'joel zola': 15,
  you: 15,
  'lisa rivera': 48,
  'sarah chen': 5,
  'alex rivera': 13,
  'jordan kim': 56,
  'maya patel': 23,
};

function normalizeName(name?: string | null) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

export function sampleProfilePhotoForName(name?: string | null) {
  const normalized = normalizeName(name);
  const displayName = String(name || 'Street Voices member').trim() || 'Street Voices member';
  const mappedId = SAMPLE_PROFILE_PHOTO_NAMES[normalized];

  return getStreetProfileAvatarUrl({
    username: normalized.replace(/[^a-z0-9]+/g, '-'),
    display_name: displayName,
    avatar_url: mappedId ? `https://i.pravatar.cc/800?img=${mappedId}` : null,
  });
}

export function profilePhotoAlt(name?: string | null, fallback = 'Street Voices member') {
  return `${String(name || fallback).trim() || fallback} profile photo`;
}

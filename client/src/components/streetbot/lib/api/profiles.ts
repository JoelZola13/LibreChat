// Profile API for connecting to Street Bot Pro
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || 'http://localhost:3000';

export async function fetchProfile(username: string): Promise<any> {
  const url = `${API_BASE_URL}/profiles/${encodeURIComponent(username)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load profile: ${res.status}`);
  }

  return await res.json();
}

export async function fetchProfileById(profileId: string | number): Promise<any> {
  const url = `${API_BASE_URL}/profiles/id/${encodeURIComponent(profileId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to load profile by ID: ${res.status}`);
  }

  return await res.json();
}

export async function createProfile(profileData: any): Promise<any> {
  const url = `${API_BASE_URL}/profiles/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });

  if (!res.ok) {
    throw new Error(`Failed to create profile: ${res.status}`);
  }

  return await res.json();
}

export async function updateProfile(profileId: string | number, profileData: any): Promise<any> {
  const url = `${API_BASE_URL}/profiles/${encodeURIComponent(profileId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });

  if (!res.ok) {
    throw new Error(`Failed to update profile: ${res.status}`);
  }

  return await res.json();
}

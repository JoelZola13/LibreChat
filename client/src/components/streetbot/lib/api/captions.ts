/**
 * Video Captions API service for Academy.
 * Manages video caption/subtitle tracks.
 */

const API_BASE = '/sbapi';
const CAPTIONS_API = `${API_BASE}/academy/captions`;

export interface Caption {
  id: string;
  lesson_id: string;
  language_code: string;
  language_name: string;
  label: string | null;
  caption_type: 'subtitles' | 'captions';
  vtt_url: string;
  is_default: boolean;
  is_auto_generated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
}

/**
 * Get all caption tracks for a lesson
 */
export async function getLessonCaptions(lessonId: string): Promise<Caption[]> {
  const response = await fetch(`${CAPTIONS_API}/lessons/${lessonId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch captions');
  }
  return response.json();
}

/**
 * Upload a VTT caption file for a lesson
 */
export async function uploadCaption(
  lessonId: string,
  file: File,
  options: {
    languageCode?: string;
    languageName?: string;
    label?: string;
    captionType?: 'subtitles' | 'captions';
    isDefault?: boolean;
    userId?: string;
  } = {}
): Promise<Caption> {
  const formData = new FormData();
  formData.append('file', file);

  const params = new URLSearchParams();
  if (options.languageCode) params.append('language_code', options.languageCode);
  if (options.languageName) params.append('language_name', options.languageName);
  if (options.label) params.append('label', options.label);
  if (options.captionType) params.append('caption_type', options.captionType);
  if (options.isDefault !== undefined) params.append('is_default', String(options.isDefault));
  if (options.userId) params.append('user_id', options.userId);

  const response = await fetch(
    `${CAPTIONS_API}/lessons/${lessonId}/upload?${params.toString()}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Failed to upload caption');
  }

  return response.json();
}

/**
 * Update caption metadata
 */
export async function updateCaption(
  captionId: string,
  data: {
    languageName?: string;
    label?: string;
    captionType?: 'subtitles' | 'captions';
    isDefault?: boolean;
  }
): Promise<Caption> {
  const response = await fetch(`${CAPTIONS_API}/${captionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language_name: data.languageName,
      label: data.label,
      caption_type: data.captionType,
      is_default: data.isDefault,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update caption');
  }

  return response.json();
}

/**
 * Delete a caption track
 */
export async function deleteCaption(captionId: string): Promise<void> {
  const response = await fetch(`${CAPTIONS_API}/${captionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete caption');
  }
}

/**
 * Set a caption as the default for its lesson
 */
export async function setDefaultCaption(captionId: string): Promise<void> {
  const response = await fetch(`${CAPTIONS_API}/${captionId}/set-default`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to set default caption');
  }
}

/**
 * Get list of supported languages
 */
export async function getSupportedLanguages(): Promise<SupportedLanguage[]> {
  const response = await fetch(`${CAPTIONS_API}/languages`);
  if (!response.ok) {
    throw new Error('Failed to fetch languages');
  }
  return response.json();
}

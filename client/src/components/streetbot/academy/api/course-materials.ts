/**
 * Course Materials API adapter for LibreChat (Vite).
 */

import { sbFetch } from '../../shared/sbFetch';

// =============================================================================
// Types
// =============================================================================

export type MaterialType = 'syllabus' | 'handout' | 'reading' | 'worksheet' | 'reference' | 'supplementary';

export const MATERIAL_TYPES: MaterialType[] = ['syllabus', 'handout', 'reading', 'worksheet', 'reference', 'supplementary'];

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: 'Syllabus', handout: 'Handout', reading: 'Reading', worksheet: 'Worksheet', reference: 'Reference', supplementary: 'Supplementary',
};

export const MATERIAL_TYPE_ICONS: Record<MaterialType, string> = {
  syllabus: '\u{1F4CB}', handout: '\u{1F4C4}', reading: '\u{1F4D6}', worksheet: '\u{1F4DD}', reference: '\u{1F4DA}', supplementary: '\u{1F4CE}',
};

export interface CourseMaterial {
  linkId: string;
  documentId: string;
  title: string;
  documentType: string;
  status: string;
  materialType: MaterialType;
  sortOrder: number;
  wordCount: number;
  readingTimeMinutes: number;
  authorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinkDocumentRequest {
  documentId: string;
  materialType?: MaterialType;
  sortOrder?: number;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await sbFetch(endpoint, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }
  return response.json();
}

export async function getMaterialTypes(): Promise<MaterialType[]> {
  const response = await fetchAPI<{ types: MaterialType[] }>('/api/course-materials/types');
  return response.types;
}

export async function getCourseMaterials(courseId: string): Promise<CourseMaterial[]> {
  return fetchAPI<CourseMaterial[]>(`/api/course-materials/courses/${courseId}`);
}

export async function linkDocumentToCourse(courseId: string, request: LinkDocumentRequest, createdBy?: string): Promise<{ success: boolean; linkId: string }> {
  const params = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : '';
  return fetchAPI(`/api/course-materials/courses/${courseId}${params}`, { method: 'POST', body: JSON.stringify(request) });
}

export async function getModuleMaterials(moduleId: string): Promise<CourseMaterial[]> {
  return fetchAPI<CourseMaterial[]>(`/api/course-materials/modules/${moduleId}`);
}

export async function linkDocumentToModule(moduleId: string, request: LinkDocumentRequest, createdBy?: string): Promise<{ success: boolean; linkId: string }> {
  const params = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : '';
  return fetchAPI(`/api/course-materials/modules/${moduleId}${params}`, { method: 'POST', body: JSON.stringify(request) });
}

export async function getLessonMaterials(lessonId: string): Promise<CourseMaterial[]> {
  return fetchAPI<CourseMaterial[]>(`/api/course-materials/lessons/${lessonId}`);
}

export async function linkDocumentToLesson(lessonId: string, request: LinkDocumentRequest, createdBy?: string): Promise<{ success: boolean; linkId: string }> {
  const params = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : '';
  return fetchAPI(`/api/course-materials/lessons/${lessonId}${params}`, { method: 'POST', body: JSON.stringify(request) });
}

export async function reorderLessonMaterials(lessonId: string, linkIds: string[]): Promise<{ success: boolean }> {
  return fetchAPI(`/api/course-materials/lessons/${lessonId}/reorder`, { method: 'PUT', body: JSON.stringify({ linkIds }) });
}

export async function removeMaterialLink(linkId: string): Promise<{ success: boolean }> {
  return fetchAPI(`/api/course-materials/links/${linkId}`, { method: 'DELETE' });
}

export async function updateMaterialType(linkId: string, materialType: MaterialType): Promise<{ success: boolean }> {
  return fetchAPI(`/api/course-materials/links/${linkId}/type`, { method: 'PATCH', body: JSON.stringify({ materialType }) });
}

// =============================================================================
// Helper Functions
// =============================================================================

export function groupMaterialsByType(materials: CourseMaterial[]): Record<MaterialType, CourseMaterial[]> {
  const grouped: Record<MaterialType, CourseMaterial[]> = { syllabus: [], handout: [], reading: [], worksheet: [], reference: [], supplementary: [] };
  for (const m of materials) {
    const type = m.materialType || 'supplementary';
    (grouped[type] || grouped.supplementary).push(m);
  }
  for (const type of MATERIAL_TYPES) grouped[type].sort((a, b) => a.sortOrder - b.sortOrder);
  return grouped;
}

export function calculateTotalReadingTime(materials: CourseMaterial[]): number {
  return materials.reduce((sum, m) => sum + m.readingTimeMinutes, 0);
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

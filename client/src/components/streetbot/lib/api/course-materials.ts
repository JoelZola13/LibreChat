/**
 * Course Materials API service - connects frontend to backend for linking
 * documents to academy courses, modules, and lessons.
 */

// ============================================================================
// Types
// ============================================================================

export type MaterialType =
  | "syllabus"
  | "handout"
  | "reading"
  | "worksheet"
  | "reference"
  | "supplementary";

export const MATERIAL_TYPES: MaterialType[] = [
  "syllabus",
  "handout",
  "reading",
  "worksheet",
  "reference",
  "supplementary",
];

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  syllabus: "Syllabus",
  handout: "Handout",
  reading: "Reading",
  worksheet: "Worksheet",
  reference: "Reference",
  supplementary: "Supplementary",
};

export const MATERIAL_TYPE_ICONS: Record<MaterialType, string> = {
  syllabus: "📋",
  handout: "📄",
  reading: "📖",
  worksheet: "📝",
  reference: "📚",
  supplementary: "📎",
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

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE = '/sbapi';

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Course Materials API
// ============================================================================

/**
 * Get all available material types
 */
export async function getMaterialTypes(): Promise<MaterialType[]> {
  const response = await fetchAPI<{ types: MaterialType[] }>(
    "/api/course-materials/types"
  );
  return response.types;
}

// ============================================================================
// Course Materials
// ============================================================================

/**
 * Get all materials linked to a course
 */
export async function getCourseMaterials(
  courseId: string
): Promise<CourseMaterial[]> {
  return fetchAPI<CourseMaterial[]>(
    `/api/course-materials/courses/${courseId}`
  );
}

/**
 * Link a document to a course
 */
export async function linkDocumentToCourse(
  courseId: string,
  request: LinkDocumentRequest,
  createdBy?: string
): Promise<{ success: boolean; linkId: string }> {
  const params = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : "";
  return fetchAPI(`/api/course-materials/courses/${courseId}${params}`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================================
// Module Materials
// ============================================================================

/**
 * Get all materials linked to a module
 */
export async function getModuleMaterials(
  moduleId: string
): Promise<CourseMaterial[]> {
  return fetchAPI<CourseMaterial[]>(
    `/api/course-materials/modules/${moduleId}`
  );
}

/**
 * Link a document to a module
 */
export async function linkDocumentToModule(
  moduleId: string,
  request: LinkDocumentRequest,
  createdBy?: string
): Promise<{ success: boolean; linkId: string }> {
  const params = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : "";
  return fetchAPI(`/api/course-materials/modules/${moduleId}${params}`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================================
// Lesson Materials
// ============================================================================

/**
 * Get all materials linked to a lesson
 */
export async function getLessonMaterials(
  lessonId: string
): Promise<CourseMaterial[]> {
  return fetchAPI<CourseMaterial[]>(
    `/api/course-materials/lessons/${lessonId}`
  );
}

/**
 * Link a document to a lesson
 */
export async function linkDocumentToLesson(
  lessonId: string,
  request: LinkDocumentRequest,
  createdBy?: string
): Promise<{ success: boolean; linkId: string }> {
  const params = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : "";
  return fetchAPI(`/api/course-materials/lessons/${lessonId}${params}`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Reorder materials for a lesson
 */
export async function reorderLessonMaterials(
  lessonId: string,
  linkIds: string[]
): Promise<{ success: boolean }> {
  return fetchAPI(`/api/course-materials/lessons/${lessonId}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ linkIds }),
  });
}

// ============================================================================
// Material Link Management
// ============================================================================

/**
 * Remove a material link (does not delete the document)
 */
export async function removeMaterialLink(
  linkId: string
): Promise<{ success: boolean }> {
  return fetchAPI(`/api/course-materials/links/${linkId}`, {
    method: "DELETE",
  });
}

/**
 * Update the material type of a link
 */
export async function updateMaterialType(
  linkId: string,
  materialType: MaterialType
): Promise<{ success: boolean }> {
  return fetchAPI(`/api/course-materials/links/${linkId}/type`, {
    method: "PATCH",
    body: JSON.stringify({ materialType }),
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Group materials by type for display
 */
export function groupMaterialsByType(
  materials: CourseMaterial[]
): Record<MaterialType, CourseMaterial[]> {
  const grouped: Record<MaterialType, CourseMaterial[]> = {
    syllabus: [],
    handout: [],
    reading: [],
    worksheet: [],
    reference: [],
    supplementary: [],
  };

  for (const material of materials) {
    const type = material.materialType || "supplementary";
    if (grouped[type]) {
      grouped[type].push(material);
    } else {
      grouped.supplementary.push(material);
    }
  }

  // Sort each group by sortOrder
  for (const type of MATERIAL_TYPES) {
    grouped[type].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return grouped;
}

/**
 * Calculate total reading time for materials
 */
export function calculateTotalReadingTime(
  materials: CourseMaterial[]
): number {
  return materials.reduce((sum, m) => sum + m.readingTimeMinutes, 0);
}

/**
 * Format reading time for display
 */
export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

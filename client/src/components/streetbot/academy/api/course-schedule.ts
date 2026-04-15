import { sbFetch } from "../../shared/sbFetch";

const BASE = "/api/academy";

export type CourseScheduleCategory = "assignment" | "reading" | "material";

export interface CourseScheduleItem {
  id: string;
  courseId: string;
  title: string;
  notes?: string | null;
  scheduledAt: string;
  category: CourseScheduleCategory;
  createdBy?: string | null;
  linkedAssignmentId?: string | null;
  linkedMaterialLinkId?: string | null;
  fileName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateCourseScheduleItemData {
  title: string;
  notes?: string;
  scheduledAt: string;
  category: CourseScheduleCategory;
  fileName?: string;
  documentType?: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
}

function transformScheduleItem(api: any): CourseScheduleItem {
  return {
    id: api.id,
    courseId: api.course_id ?? api.courseId,
    title: api.title,
    notes: api.notes ?? null,
    scheduledAt: api.scheduled_at ?? api.scheduledAt,
    category: api.category,
    createdBy: api.created_by ?? api.createdBy ?? null,
    linkedAssignmentId: api.linked_assignment_id ?? api.linkedAssignmentId ?? null,
    linkedMaterialLinkId: api.linked_material_link_id ?? api.linkedMaterialLinkId ?? null,
    fileName: api.file_name ?? api.fileName ?? null,
    createdAt: api.created_at ?? api.createdAt ?? null,
    updatedAt: api.updated_at ?? api.updatedAt ?? null,
  };
}

export async function listCourseScheduleItems(courseId: string): Promise<CourseScheduleItem[]> {
  const response = await sbFetch(BASE + "/courses/" + courseId + "/schedule-items");
  if (response.ok === false) {
    throw new Error("Failed to fetch course schedule items");
  }
  const data = await response.json();
  return Array.isArray(data) ? data.map(transformScheduleItem) : [];
}

export async function createCourseScheduleItem(
  courseId: string,
  data: CreateCourseScheduleItemData,
  createdBy?: string,
): Promise<CourseScheduleItem> {
  const query = createdBy ? "?created_by=" + encodeURIComponent(createdBy) : "";
  const response = await sbFetch(BASE + "/courses/" + courseId + "/schedule-items" + query, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: data.title,
      notes: data.notes,
      scheduled_at: data.scheduledAt,
      category: data.category,
      file_name: data.fileName,
      document_type: data.documentType,
      file_url: data.fileUrl,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      uploaded_at: data.uploadedAt,
    }),
  });
  if (response.ok === false) {
    throw new Error("Failed to create course schedule item");
  }
  return transformScheduleItem(await response.json());
}

export async function deleteCourseScheduleItem(itemId: string): Promise<void> {
  const response = await sbFetch(BASE + "/schedule-items/" + itemId, { method: "DELETE" });
  if (response.ok === false) {
    throw new Error("Failed to delete course schedule item");
  }
}

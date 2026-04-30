import { sbFetch } from "../../shared/sbFetch";
import type { AcademyFileAsset } from "../academyFileAssets";

export type EnrollmentApplication = {
  id: string;
  user_id: string;
  target_type: "course" | "learning_path";
  target_id: string;
  target_title?: string | null;
  course_id?: string | null;
  course_ids: string[];
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  heard_about?: string | null;
  prior_experience?: string | null;
  interest_areas: string[];
  past_project?: string | null;
  future_project?: string | null;
  program_goals?: string | null;
  challenges?: string | null;
  general_comments?: string | null;
  sample_work_attachments: AcademyFileAsset[];
  status?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateEnrollmentApplicationPayload = {
  user_id: string;
  target_type: "course" | "learning_path";
  target_id: string;
  target_title: string;
  course_ids: string[];
  first_name: string;
  last_name: string;
  preferred_name?: string;
  full_name?: string;
  email: string;
  heard_about: string;
  prior_experience: string;
  interest_areas: string[];
  past_project?: string;
  future_project: string;
  program_goals: string;
  challenges: string;
  general_comments?: string;
  sample_work_attachments?: AcademyFileAsset[];
};

function toApplication(record: any): EnrollmentApplication {
  return {
    id: String(record.id),
    user_id: String(record.user_id),
    target_type: record.target_type === "learning_path" ? "learning_path" : "course",
    target_id: String(record.target_id || ""),
    target_title: record.target_title ?? null,
    course_id: record.course_id ?? null,
    course_ids: Array.isArray(record.course_ids) ? record.course_ids.map((item: unknown) => String(item)) : [],
    first_name: record.first_name ?? null,
    last_name: record.last_name ?? null,
    preferred_name: record.preferred_name ?? null,
    full_name: record.full_name ?? null,
    email: record.email ?? null,
    heard_about: record.heard_about ?? null,
    prior_experience: record.prior_experience ?? null,
    interest_areas: Array.isArray(record.interest_areas) ? record.interest_areas.map((item: unknown) => String(item)) : [],
    past_project: record.past_project ?? null,
    future_project: record.future_project ?? null,
    program_goals: record.program_goals ?? null,
    challenges: record.challenges ?? null,
    general_comments: record.general_comments ?? null,
    sample_work_attachments: Array.isArray(record.sample_work_attachments) ? record.sample_work_attachments : [],
    status: record.status ?? null,
    submitted_at: record.submitted_at ?? null,
    created_at: record.created_at ?? null,
    updated_at: record.updated_at ?? null,
  };
}

export async function createEnrollmentApplication(payload: CreateEnrollmentApplicationPayload) {
  const response = await sbFetch("/api/academy/enrollment-applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to submit enrollment form");
  }
  return toApplication(await response.json());
}

export async function listEnrollmentApplications(params: { courseId?: string; userId?: string }) {
  const query = new URLSearchParams();
  if (params.courseId) {
    query.set("course_id", params.courseId);
  }
  if (params.userId) {
    query.set("user_id", params.userId);
  }
  const response = await sbFetch(`/api/academy/enrollment-applications?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load enrollment applications");
  }
  const data = await response.json();
  return Array.isArray(data) ? data.map(toApplication) : [];
}

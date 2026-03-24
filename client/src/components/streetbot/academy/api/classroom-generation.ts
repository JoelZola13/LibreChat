/**
 * OpenMAIC classroom generation API adapter.
 * Used by the instructor page to create AI-generated courses.
 */
import { sbFetch } from '../../shared/sbFetch';

const ACADEMY_BASE = '/api/academy';

export interface GenerationJob {
  jobId: string;
  pollUrl?: string;
  status?: string;
}

export interface GenerationStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: {
    step?: string;
    percent?: number;
    message?: string;
  };
  result?: {
    courseId?: string;
    title?: string;
    moduleCount?: number;
    lessonCount?: number;
    quizCount?: number;
  };
  error?: string;
}

/**
 * Start AI-powered course generation from a topic.
 * Creates a course via the academic agent's OpenMAIC integration.
 */
export async function startCourseGeneration(params: {
  topic: string;
  level?: string;
  category?: string;
  duration?: string;
  instructor_name?: string;
}): Promise<GenerationJob> {
  const resp = await sbFetch(`${ACADEMY_BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!resp.ok) throw new Error(`Course creation failed: ${resp.status}`);
  const data = await resp.json();
  return { jobId: data.id, status: 'completed' };
}

/**
 * List all courses (for refreshing after generation).
 */
export async function listCourses(): Promise<unknown[]> {
  const resp = await sbFetch(`${ACADEMY_BASE}/courses`);
  if (!resp.ok) throw new Error(`Failed to list courses: ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

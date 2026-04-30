import { sbFetch } from "../../shared/sbFetch";

const BASE = "/api/academy";

export type AttendanceStatus = "present" | "absent";

export interface CourseAttendanceStudent {
  recordId?: string | null;
  courseId: string;
  classDate: string;
  userId: string;
  studentId: string;
  userName: string;
  attendanceStatus?: AttendanceStatus | null;
  markedBy?: string | null;
  updatedAt?: string | null;
  progressPercent?: number;
  enrollmentStatus?: string;
}

export interface CourseAttendanceRoster {
  courseId: string;
  classDate: string;
  students: CourseAttendanceStudent[];
  total: number;
  presentCount: number;
  absentCount: number;
}

export interface MarkCourseAttendanceInput {
  classDate: string;
  userId: string;
  attendanceStatus: AttendanceStatus;
  markedBy?: string;
}

function transformAttendanceStudent(api: any): CourseAttendanceStudent {
  return {
    recordId: api.record_id ?? api.recordId ?? api.id ?? null,
    courseId: api.course_id ?? api.courseId,
    classDate: api.class_date ?? api.classDate,
    userId: api.user_id ?? api.userId,
    studentId: api.student_id ?? api.studentId ?? api.user_id ?? api.userId,
    userName: api.user_name ?? api.userName ?? "Academy learner",
    attendanceStatus: api.attendance_status ?? api.attendanceStatus ?? null,
    markedBy: api.marked_by ?? api.markedBy ?? null,
    updatedAt: api.updated_at ?? api.updatedAt ?? null,
    progressPercent: api.progress_percent ?? api.progressPercent ?? 0,
    enrollmentStatus: api.enrollment_status ?? api.enrollmentStatus ?? "active",
  };
}

export async function getCourseAttendance(courseId: string, classDate: string): Promise<CourseAttendanceRoster> {
  const response = await sbFetch(
    `${BASE}/courses/${courseId}/attendance?class_date=${encodeURIComponent(classDate)}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch course attendance");
  }
  const data = await response.json();
  const students = Array.isArray(data.students) ? data.students.map(transformAttendanceStudent) : [];
  return {
    courseId: data.course_id ?? data.courseId ?? courseId,
    classDate: data.class_date ?? data.classDate ?? classDate,
    students,
    total: data.total ?? students.length,
    presentCount: data.present_count ?? students.filter((student) => student.attendanceStatus === "present").length,
    absentCount: data.absent_count ?? students.filter((student) => student.attendanceStatus === "absent").length,
  };
}

export async function markCourseAttendance(
  courseId: string,
  input: MarkCourseAttendanceInput,
): Promise<CourseAttendanceStudent> {
  const response = await sbFetch(`${BASE}/courses/${courseId}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      class_date: input.classDate,
      user_id: input.userId,
      attendance_status: input.attendanceStatus,
      marked_by: input.markedBy,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to save attendance");
  }
  return transformAttendanceStudent(await response.json());
}
